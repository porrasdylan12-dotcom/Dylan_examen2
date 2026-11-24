<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Equipos</ion-title>
        <ion-buttons slot="end">
          <ion-button router-link="/tabs/equipos/nuevo" aria-label="Nuevo equipo">
            <ion-icon slot="icon-only" :icon="add" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar v-model="q" :debounce="400" placeholder="Buscar por código o nombre" @ion-input="buscar" />
      </ion-toolbar>
      <!-- YA IMPLEMENTADO: depende de useConexion() [M7] -->
      <ion-toolbar v-if="!conectado" color="warning">
        <ion-title size="small">Sin conexión: los datos pueden estar desactualizados</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="refrescar($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div v-if="cargando && equipos.length === 0">
        <ion-list>
          <ion-item v-for="n in 6" :key="n">
            <ion-label>
              <ion-skeleton-text :animated="true" style="width: 60%" />
              <ion-skeleton-text :animated="true" style="width: 40%" />
            </ion-label>
          </ion-item>
        </ion-list>
      </div>

      <div v-else-if="error && equipos.length === 0" class="estado-vacio">
        <ion-icon :icon="cloudOfflineOutline" />
        <p>{{ error }}</p>
        <ion-button fill="outline" @click="cargar(true)">Reintentar</ion-button>
      </div>

      <div v-else-if="!cargando && equipos.length === 0" class="estado-vacio">
        <ion-icon :icon="searchOutline" />
        <p>No se encontraron equipos</p>
      </div>

      <ion-list v-else>
        <ion-item-sliding v-for="equipo in equipos" :key="equipo.id">
          <ion-item :router-link="`/tabs/equipos/${equipo.id}/editar`" detail>
            <ion-label>
              <h2>{{ equipo.nombre }}</h2>
              <p>{{ equipo.codigo }} · {{ equipo.categoria.nombre }}</p>
            </ion-label>
            <ion-badge slot="end" :color="colorEstado[equipo.estado]">{{ equipo.estado }}</ion-badge>
          </ion-item>
          <ion-item-options side="end">
            <ion-item-option color="danger" @click="confirmarEliminacion(equipo, $event)">
              <ion-icon slot="icon-only" :icon="trashOutline" />
            </ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
      </ion-list>

      <ion-infinite-scroll :disabled="!hayMas" @ionInfinite="cargarMas($event)">
        <ion-infinite-scroll-content />
      </ion-infinite-scroll>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonSearchbar, IonContent,
  IonRefresher, IonRefresherContent, IonList, IonItem, IonLabel, IonSkeletonText, IonBadge,
  IonItemSliding, IonItemOptions, IonItemOption, IonInfiniteScroll, IonInfiniteScrollContent,
  alertController, onIonViewWillEnter,
} from '@ionic/vue';
import type { InfiniteScrollCustomEvent, RefresherCustomEvent } from '@ionic/vue';
import { add, cloudOfflineOutline, searchOutline, trashOutline } from 'ionicons/icons';
import { eliminar, listar, type Equipo, type Estado } from '@/services/equipos';
import { ErrorApi } from '@/services/errores';
import { mostrarToast } from '@/services/avisos';
import { useConexion, vibrar } from '@/composables/useConexion';

// Importaciones disponibles para su template (evita advertencias mientras no las use)
void [IonRefresher, IonRefresherContent, IonList, IonItem, IonLabel, IonSkeletonText, IonBadge,
  IonItemSliding, IonItemOptions, IonItemOption, IonInfiniteScroll, IonInfiniteScrollContent,
  cloudOfflineOutline, searchOutline, trashOutline];

const colorEstado: Record<Estado, string> = { disponible: 'success', prestado: 'warning', mantenimiento: 'medium' };

const { conectado } = useConexion();

const equipos = ref<Equipo[]>([]);
const pagina = ref(0);
const ultimaPagina = ref(1);
const q = ref('');
const cargando = ref(false);
const error = ref('');
const hayMas = computed(() => pagina.value < ultimaPagina.value);

/**
 * TODO [M4] cargar(reiniciar)
 *  - reiniciar = true  → pide la página 1 y REEMPLAZA la lista.
 *  - reiniciar = false → pide la página siguiente y la AGREGA al final.
 *  - Use listar(pagina, q) de services/equipos.ts y actualice pagina/ultimaPagina con meta.
 *  - Maneje cargando y error (un 401 ya lo resuelve api.ts).
 */
async function cargar(reiniciar = false) {
  if (cargando.value) return;
  error.value = '';
  cargando.value = true;
  try {
    const pag = reiniciar ? 1 : pagina.value + 1;
    const resultado = await listar(pag, q.value);
    if (reiniciar) {
      equipos.value = resultado.data;
    } else {
      equipos.value = [...equipos.value, ...resultado.data];
    }
    pagina.value = resultado.meta.current_page;
    ultimaPagina.value = resultado.meta.last_page;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar equipos';
  } finally {
    cargando.value = false;
  }
}

/**
 * TODO [M4] La lista debe recargarse CADA VEZ que la persona vuelve a esta página
 *           (por ejemplo, al regresar del formulario). Elija el hook de ciclo de vida correcto.
 */
onIonViewWillEnter(() => cargar(true));

const buscar = () => cargar(true);

/** TODO [M4] Recargar desde la página 1 y cerrar el refresher (evento.target.complete()). */
async function refrescar(evento: RefresherCustomEvent) {
  await cargar(true);
  evento.target.complete();
}

/** TODO [M4] Cargar la página siguiente y cerrar el infinite scroll (evento.target.complete()). */
async function cargarMas(evento: InfiniteScrollCustomEvent) {
  await cargar(false);
  evento.target.complete();
}

/**
 * TODO [M6] confirmarEliminacion(equipo, evento)
 *  1. Cierre el ion-item-sliding.
 *  2. alertController con dos botones: role 'cancel' y role 'destructive'.
 *     Lea el role con onDidDismiss(); si no es 'destructive', no haga nada.
 *  3. eliminar(equipo.id):
 *       204 → quitar el equipo de la lista (sin recargar todo), vibrar() y toast de éxito.
 *       409 → toast con el mensaje que envía la API (regla R1: equipo prestado). El equipo sigue en la lista.
 *       404 → quitarlo de la lista y avisar que ya no existe.
 */
async function confirmarEliminacion(equipo: Equipo, evento: Event) {
  const slidingItem = (evento.target as HTMLElement).closest('ion-item-sliding') as HTMLIonItemSlidingElement;
  if (slidingItem) await slidingItem.close();

  const alerta = await alertController.create({
    header: 'Confirmar eliminación',
    message: `¿Eliminar «${equipo.nombre}»?`,
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Eliminar', role: 'destructive' },
    ],
  });
  await alerta.present();
  const { role } = await alerta.onDidDismiss();
  if (role !== 'destructive') return;

  try {
    await eliminar(equipo.id);
    equipos.value = equipos.value.filter((e) => e.id !== equipo.id);
    await vibrar();
    mostrarToast('Equipo eliminado', 'success');
  } catch (e) {
    if (e instanceof ErrorApi && e.status === 409) {
      mostrarToast(e.cuerpo?.mensaje ?? 'No se puede eliminar', 'warning');
    } else if (e instanceof ErrorApi && e.status === 404) {
      equipos.value = equipos.value.filter((eq) => eq.id !== equipo.id);
      mostrarToast('El equipo ya no existe', 'warning');
    } else {
      mostrarToast('Error al eliminar el equipo', 'danger');
    }
  }
}

void [colorEstado, hayMas];
</script>
