import { useEffect, useState } from 'react';
import { apiClient } from '../../../services/api/client';
import { telemetrySocket } from '../../../services/ws/telemetrySocket';
import { mapWsHealthEventToDeviceHealth } from '../../../services/api/http/mappers/assets';
import { DeviceHealth, EdgeDevice } from '../../../types/assets';

/**
 * Data kesehatan perangkat untuk DeviceHealthDrawer (E32.7, FAT-288:
 * dipindah dari components/DeviceHealthDrawer.tsx — alur data vs
 * presentasi; drawer hanya me-render).
 *
 * FAT-261: dari mana health terakhir berasal — 'http' (snapshot awal /
 * Refresh manual) atau 'ws' (HEALTH_UPDATE live tiap ~5 dtk). Selagi
 * drawer terbuka, HEALTH_UPDATE untuk device ini memperbarui health
 * secara live — HTTP tetap jadi snapshot awal dan Refresh manual.
 * Frame device lain diabaikan.
 */
export function useDeviceHealth(device: EdgeDevice | null) {
  const [health, setHealth] = useState<DeviceHealth | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [source, setSource] = useState<'http' | 'ws'>('http');

  const fetchHealth = async (deviceId: string) => {
    setIsLoading(true);
    try {
      const res = await apiClient.getDeviceHealth(deviceId);
      setHealth(res);
      setSource('http');
    } catch {
      setHealth(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (device) {
      setSource('http');
      fetchHealth(device.device_id);
    } else {
      setHealth(null);
    }
  }, [device]);

  useEffect(() => {
    if (!device) return;
    const deviceId = device.device_id;
    const unsub = telemetrySocket.subscribe((event) => {
      if (event.type === 'HEALTH_UPDATE' && event.device_id === deviceId) {
        setHealth(mapWsHealthEventToDeviceHealth(event));
        setSource('ws');
      }
    });
    return () => unsub();
  }, [device]);

  return { health, isLoading, source, fetchHealth };
}
