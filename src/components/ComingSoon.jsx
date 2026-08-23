import { useState } from 'react';

export default function ComingSoon() {
  const [showCountdown, setShowCountdown] = useState(true);
  const [count, setCount] = useState(60);

  const interval = setInterval(() => {
    setCount((prev) => {
      if (prev <= 0) {
        setShowCountdown(false);
        return 0;
      }
      return prev - 1;
    });
  }, 1000);

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-600 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white/90 backdrop-blur-md rounded-2xl p-8 max-w-md w-full text-center shadow-2xl border border-white/20">
        <div className="animate-bounce text-indigo-600 text-6xl mb-4">🚀</div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Biz tez kunda ochamiz!</h1>
        <p className="text-gray-600 text-lg mb-8">Sizning uchun yuqori sifatli tajriba tayyorlaymiz. Kichikroq kutish - maxsus imtihon!</p>
        
        </div>
    </div>
  );
}