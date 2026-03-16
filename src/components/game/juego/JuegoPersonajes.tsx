import Image from 'next/image';
import { SOSPECHOSOS, PERSONAJE_META } from '@/types/domain';
import { getTranslations } from 'next-intl/server';

const PERSONAJE_COPY_KEYS = {
  'Directora Scarlett': {
    departamento: 'personajeScarlettDepartamento',
    descripcion: 'personajeScarlettDescripcion',
  },
  'Coronel Mustard': {
    departamento: 'personajeMustardDepartamento',
    descripcion: 'personajeMustardDescripcion',
  },
  'Sra. White': {
    departamento: 'personajeWhiteDepartamento',
    descripcion: 'personajeWhiteDescripcion',
  },
  'Sr. Green': {
    departamento: 'personajeGreenDepartamento',
    descripcion: 'personajeGreenDescripcion',
  },
  'Dra. Peacock': {
    departamento: 'personajePeacockDepartamento',
    descripcion: 'personajePeacockDescripcion',
  },
  'Profesor Plum': {
    departamento: 'personajePlumDepartamento',
    descripcion: 'personajePlumDescripcion',
  },
} as const;

export async function JuegoPersonajes() {
  const t = await getTranslations('juego');
  return (
    <section aria-labelledby="personajes-heading">
      <h2
        id="personajes-heading"
        className="text-xs font-semibold tracking-widest uppercase text-cyan-400 mb-5"
      >
        {t('personajesHeading')}
      </h2>

      {/* Character cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {SOSPECHOSOS.map((nombre) => {
          const meta = PERSONAJE_META[nombre] ?? { color: '#64748b', departamento: '', descripcion: '', imagen: '' };
          const copyKeys = PERSONAJE_COPY_KEYS[nombre];
          return (
            <div
              key={nombre}
              className="rounded-lg overflow-hidden flex flex-col"
              style={{
                background: 'rgba(30,41,59,0.6)',
                border: `1px solid ${meta.color}50`,
              }}
            >
              {/* Character image */}
              <div className="relative w-full" style={{ aspectRatio: '2/3' }}>
                <Image
                  src={meta.imagen}
                  alt={nombre}
                  fill
                  quality={75}
                  className="object-cover object-top"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                />
                {/* Department badge */}
                <span
                  className="absolute bottom-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
                  style={{ background: `${meta.color}cc`, color: '#fff' }}
                >
                  {copyKeys ? t(copyKeys.departamento) : meta.departamento}
                </span>
              </div>
              {/* Name + description */}
              <div className="p-2 flex flex-col gap-1">
                <p className="text-xs font-semibold text-white leading-tight">{nombre}</p>
                <p className="text-[10px] text-slate-500 leading-tight">
                  {copyKeys ? t(copyKeys.descripcion) : meta.descripcion}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-600 mt-3">
        {t('personajesNota')}
      </p>
    </section>
  );
}
