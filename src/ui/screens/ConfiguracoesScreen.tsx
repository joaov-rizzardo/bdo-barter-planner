import { useSettingsStore } from '../../store/settingsStore';
import { Aviso, TextButton } from '../components/controls';
import { BarganhaSection } from './configuracoes/BarganhaSection';
import { NavioSection } from './configuracoes/NavioSection';
import { PortosSection } from './configuracoes/PortosSection';
import { RotaSection } from './configuracoes/RotaSection';

export function ConfiguracoesScreen() {
  const erroPersistencia = useSettingsStore((s) => s.erroPersistencia);
  const resetar = useSettingsStore((s) => s.resetar);

  return (
    <div className="space-y-5">
      {erroPersistencia ? (
        <Aviso tipo="aviso">
          As alterações não estão sendo salvas em disco: {erroPersistencia}
        </Aviso>
      ) : null}

      <BarganhaSection />
      <NavioSection />
      <RotaSection />
      <PortosSection />

      <div className="flex justify-end">
        <TextButton variante="perigo" onClick={resetar}>
          Restaurar configurações padrão
        </TextButton>
      </div>
    </div>
  );
}
