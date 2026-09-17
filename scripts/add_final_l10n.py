import json
from pathlib import Path

path = Path('mobile/tool/l10n.json')
data = json.loads(path.read_text())

data['To‘lovni boshlash uchun profilingizdagi ismni kiriting.'] = [
    'Чтобы начать оплату, укажите имя в профиле.',
    'Enter your profile name to start payment.',
]
data['{tizim} to‘lov sahifasini ochib bo‘lmadi. Qayta urinib ko‘ring.'] = [
    'Не удалось открыть страницу оплаты {tizim}. Попробуйте ещё раз.',
    'Could not open the {tizim} payment page. Try again.',
]
data['Click bilan to‘lash'] = [
    'Оплатить через Click',
    'Pay with Click',
]

path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
print('final translations added')
