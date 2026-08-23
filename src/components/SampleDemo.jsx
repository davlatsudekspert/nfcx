import { useState } from 'react';

export default function SampleDemo() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Demo komponenta</h1>

      <div className="bg-white rounded-lg p-6 shadow-md">
        <p className="text-gray-600 mb-4">Soni: {count}</p>

        <button
          onClick={() => setCount(count + 1)}
          className="btn btn-primary"
        >
          Qo'ssh
        </button>

        <p className="mt-4">
          <label className="block text-sm font-medium mb-2">
            Ismingiz:
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input input-bordered w-full"
            placeholder="Ismingizni kiriting"
          />
        </p>

        {name && <p className="mt-3 text-green-600">Xush kelibsiz, {name}!</p>}
      </div>
    </div>
  );
}