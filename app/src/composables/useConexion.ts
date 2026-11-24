import { onUnmounted, ref } from 'vue';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export function useConexion() {
  const conectado = ref(true);
  const tipo = ref('unknown');

  Network.getStatus().then((status) => {
    conectado.value = status.connected;
    tipo.value = status.connectionType;
  });

  const handle = Network.addListener('networkStatusChange', (status) => {
    conectado.value = status.connected;
    tipo.value = status.connectionType;
  });

  onUnmounted(() => {
    handle.then((h) => h.remove());
  });

  return { conectado, tipo };
}

export async function vibrar() {
  if (Capacitor.isNativePlatform()) {
    await Haptics.impact({ style: ImpactStyle.Light });
  }
}
