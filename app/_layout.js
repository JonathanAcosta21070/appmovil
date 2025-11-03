// app/_layout.js
import { Stack } from "expo-router";
import { SyncProvider } from '../contexts/SyncContext';
import { BleProvider } from '../contexts/BleContext';

export default function RootLayout() {
  return (
    <SyncProvider>
      <BleProvider>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="registro" options={{ title: 'Registro' }} />
          
          {/* Pantallas por rol */}
          {/* farmer */}
          <Stack.Screen name="farmer/home-farmer" options={{ title: 'Panel Agricultor', headerBackVisible: false }} />
          <Stack.Screen name="farmer/action-register" options={{ title: 'Registrar Acción' }} />
          <Stack.Screen name="farmer/history" options={{ title: 'Historial' }} />
          <Stack.Screen name="farmer/crops-list" options={{ title: 'Lista de cultivos'}} />
          <Stack.Screen name="farmer/crop-details/[id]" options={{ title: 'Detalles de cultivo'}} />
          <Stack.Screen name="farmer/sensor-connection" options={{ title: 'Conexión a sensor' }} />
          <Stack.Screen name="farmer/alerts" options={{ title: 'Recomendaciones recibidas' }} />

          {/* scientist */}
          <Stack.Screen name="scientist/home-scientist" options={{ title: 'Panel Tecnico', headerBackVisible: false }} />
          <Stack.Screen name="scientist/farmer-details/[farmerId]" options={{ title: 'Detalles de agricultor'}} />
           <Stack.Screen name="scientist/crop-details/[id]" options={{ title: 'Detalles de cultivo'}} />
          <Stack.Screen name="scientist/recommendations" options={{ title: 'Recomendaciones'}} />
          <Stack.Screen name="scientist/reports" options={{ title: 'Reportes' }} />
        </Stack>
      </BleProvider>
    </SyncProvider>
  );
}