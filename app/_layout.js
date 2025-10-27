import { Stack } from "expo-router";
import { SyncProvider } from '../contexts/SyncContext';

export default function RootLayout() {
  return (
    <SyncProvider>
      <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="registro" options={{ title: 'Registro' }} />
      
      {/* Pantallas por rol */}
      {/* farmer */}
      <Stack.Screen name="farmer/home-farmer" options={{ title: 'Panel Agricultor', headerBackVisible: false }} />
      <Stack.Screen name="farmer/action-register" options={{ title: 'Registrar Acción' }} />
      <Stack.Screen name="farmer/history" options={{ title: 'Historial' }} />

      {/* scientist */}
      <Stack.Screen name="scientist/home-scientist" options={{ title: 'Panel Tecnico', headerBackVisible: false }} />
      <Stack.Screen name="scientist/farmer-details/[farmerId]" options={{ title: 'Detalles de agricultor'}} />
      <Stack.Screen name="scientist/recommendations" options={{ title: 'Recomendaciones'}} />
      <Stack.Screen name="scientist/reports" options={{ title: 'Resportes' }} />
      
    </Stack>
    </SyncProvider>
  );
}