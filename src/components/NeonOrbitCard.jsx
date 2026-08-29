import Interactive3DCard from './Interactive3DCard.jsx';
import NfcCard from './NfcCard.jsx';
import { IconWave } from './Icons.jsx';
import { useLanguage } from '../lib/i18n.jsx';

// "Neon orbit" kompozitsiyasi — aylanuvchi oltin halqa, suzuvchi NFC
// belgilar va markazda 3D karta. Bosh sahifa hero'sida va Narxlar
// sahifasida bir xil ishlatiladi.
export default function NeonOrbitCard({ code = 'AAA000', name, finish = 'black' }) {
  const { t } = useLanguage();
  const displayName = name || t('SIZNING ISMINGIZ');
  return (
    <div className="relative h-[400px] w-[400px] xl:h-[500px] xl:w-[500px]" aria-hidden="false">
      {/* Yumshoq porlash — kartaning orqasidagi chuqurlik */}
      <div className="absolute inset-[6%] rounded-full bg-[radial-gradient(circle,rgba(212,175,90,0.16),transparent_68%)] blur-[6px]"></div>

      <div className="absolute inset-[5%] rounded-full border border-[rgba(201,162,39,0.30)] shadow-[0_0_70px_rgba(180,140,30,0.22),inset_0_0_55px_rgba(201,162,39,0.10)]"></div>
      <div className="absolute -inset-[calc(5%-10px)] rounded-full border border-dashed border-[rgba(212,175,90,0.15)]"></div>
      <div className="absolute inset-[5%] animate-[spinSlow_16s_linear_infinite] rounded-full bg-[conic-gradient(from_0deg,transparent_0_76%,rgba(232,193,101,0.9)_94%,transparent_100%)] [-webkit-mask:radial-gradient(farthest-side,transparent_calc(100%_-_4px),#000_calc(100%_-_3px))] [mask:radial-gradient(farthest-side,transparent_calc(100%_-_4px),#000_calc(100%_-_3px))] [filter:drop-shadow(0_0_8px_rgba(201,162,39,0.55))]"></div>
      <div className="absolute inset-[5%] animate-[spinSlow_16s_linear_infinite] rounded-full">
        <span className="absolute -top-[5px] left-1/2 ml-[-5px] h-2.5 w-2.5 rounded-full bg-[#f0cf7a] shadow-[0_0_14px_3px_rgba(212,175,90,0.55)]"></span>
      </div>
      <div className="absolute inset-[5%] animate-[spinSlow_26s_linear_infinite_reverse] rounded-full">
        <span className="absolute -top-1 left-1/2 ml-[-4px] h-[7px] w-[7px] rounded-full bg-[#f0cf7a] opacity-75 shadow-[0_0_14px_3px_rgba(212,175,90,0.55)]"></span>
      </div>

      {/* Yorug' zarrachalar — chuqurlik his qildiradi */}
      <span className="absolute left-[18%] top-[12%] h-[5px] w-[5px] rounded-full bg-[rgba(232,193,101,0.85)] shadow-[0_0_10px_2px_rgba(212,175,90,0.5)] [animation:floatY_6s_ease-in-out_infinite] [animation-delay:.2s]"></span>
      <span className="absolute left-[10%] top-[64%] h-[3px] w-[3px] rounded-full bg-[rgba(232,193,101,0.85)] shadow-[0_0_8px_2px_rgba(212,175,90,0.45)] [animation:floatY_6s_ease-in-out_infinite] [animation-delay:1.4s]"></span>
      <span className="absolute left-[84%] top-[22%] h-[4px] w-[4px] rounded-full bg-[rgba(232,193,101,0.85)] shadow-[0_0_9px_2px_rgba(212,175,90,0.48)] [animation:floatY_6s_ease-in-out_infinite] [animation-delay:.9s]"></span>
      <span className="absolute left-[80%] top-[76%] h-[3px] w-[3px] rounded-full bg-[rgba(232,193,101,0.85)] shadow-[0_0_8px_2px_rgba(212,175,90,0.45)] [animation:floatY_6s_ease-in-out_infinite] [animation-delay:2.1s]"></span>

      <div className="absolute left-1/2 top-1/2 z-[3] -translate-x-1/2 translate-y-[-55%] animate-[floatY_5.5s_ease-in-out_infinite]">
        <Interactive3DCard>
          <NfcCard code={code} name={displayName} finish={finish} size="lg" rim />
        </Interactive3DCard>
      </div>

      <div className="absolute right-[4%] top-[2%] z-[2] flex h-[88px] w-[88px] animate-[floatY_5s_ease-in-out_infinite] flex-col items-center justify-center gap-1.5 rounded-3xl border border-[rgba(201,162,39,0.22)] bg-gradient-to-br from-[#1c1611] to-[#07070a] text-[#e8c165] shadow-[0_18px_40px_rgba(0,0,0,0.55),0_0_22px_rgba(180,140,30,0.14)] [animation-delay:0.6s]">
        <IconWave />
        <span className="font-mono text-[9px] tracking-[0.14em] text-[rgba(232,193,101,0.65)]">NFC TAP</span>
      </div>
      <div className="absolute bottom-[6%] left-0 z-[2] flex h-[88px] w-[88px] animate-[floatY_5s_ease-in-out_infinite] flex-col items-center justify-center gap-1.5 rounded-3xl border border-[rgba(201,162,39,0.22)] bg-gradient-to-br from-[#1c1611] to-[#07070a] text-[#e8c165] shadow-[0_18px_40px_rgba(0,0,0,0.55),0_0_22px_rgba(180,140,30,0.14)] [animation-delay:1.4s]">
        <IconWave />
        <span className="font-mono text-[9px] tracking-[0.14em] text-[rgba(232,193,101,0.65)]">NFC TAG</span>
      </div>

      <div className="absolute left-[6%] top-[13%] z-[2] flex animate-[floatY_5s_ease-in-out_infinite] flex-col items-center [animation-delay:1s]">
        <span className="z-[1] -mb-1.5 h-[34px] w-[34px] rounded-full border-[5px] border-[#c9a227] border-t-[#f0cf7a] border-l-[#e8c165] shadow-md"></span>
        <div className="flex h-[118px] w-[78px] flex-col items-center justify-center gap-2 rounded-[20px] border border-[rgba(201,162,39,0.18)] bg-gradient-to-b from-[#221c12] via-[#101010] to-[#1c1611] text-[#e8c165] shadow-[0_20px_44px_rgba(0,0,0,0.6),0_0_20px_rgba(180,140,30,0.12)]">
          <IconWave />
          <b className="font-mono text-[11px] tracking-[0.2em] text-[rgba(232,193,101,0.6)]">NFC</b>
        </div>
      </div>
    </div>
  );
}
