import GuideMockFrame from './GuideMockFrame.jsx';
import GuideRealFrame from './GuideRealFrame.jsx';

// Bitta "frame" — yoki haqiqiy (mahalliy sinov muhitidan olingan) NFCSTORE
// skrinshoti, yoki (mutatsiya/jismoniy amal talab qiladigan qadamlar uchun)
// sxematik namoyish. `kind` shuni belgilaydi — pastda ikkalasi ham bir xil
// prop nomlari (cursorX/cursorY/clickEffect/highlight/zoomTarget) bilan
// ishlaydi, faqat rasm manbai boshqacha.
export default function GuideFrame({ frame, className }) {
  if (frame.kind === 'real') {
    return (
      <GuideRealFrame
        src={frame.image}
        cursorX={frame.cursorX}
        cursorY={frame.cursorY}
        clickEffect={frame.clickEffect}
        highlightBox={frame.highlightBox}
        zoomTarget={frame.zoomTarget}
        className={className}
      />
    );
  }
  return (
    <GuideMockFrame
      variant={frame.image}
      cursorX={frame.cursorX}
      cursorY={frame.cursorY}
      clickEffect={frame.clickEffect}
      highlight={frame.highlight}
      zoomTarget={frame.zoomTarget}
      data={frame.data}
      className={className}
    />
  );
}
