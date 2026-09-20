// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Russian (`ru`).
class LRu extends L {
  LRu([String locale = 'ru']) : super(locale);

  @override
  String get appName => 'NFCSTORE Nova';

  @override
  String get actionContinue => 'Продолжить';

  @override
  String get actionBack => 'Назад';

  @override
  String get actionNext => 'Далее';

  @override
  String get actionSave => 'Сохранить';

  @override
  String get actionCancel => 'Отмена';

  @override
  String get actionDelete => 'Удалить';

  @override
  String get actionEdit => 'Редактировать';

  @override
  String get actionShare => 'Поделиться';

  @override
  String get actionMute => 'Выключить звук';

  @override
  String get actionUnmute => 'Включить звук';

  @override
  String get actionCopy => 'Копировать';

  @override
  String get actionCopied => 'Скопировано';

  @override
  String get actionRetry => 'Повторить';

  @override
  String get actionClose => 'Закрыть';

  @override
  String get actionOpen => 'Открыть';

  @override
  String get actionDone => 'Готово';

  @override
  String get actionConfirm => 'Подтвердить';

  @override
  String get actionAdd => 'Добавить';

  @override
  String get actionSearch => 'Поиск';

  @override
  String get actionSeeAll => 'Все';

  @override
  String get actionFollow => 'Подписаться';

  @override
  String get actionUnfollow => 'Отписаться';

  @override
  String get actionPublish => 'Опубликовать';

  @override
  String get actionSelect => 'Выбрать';

  @override
  String get actionPreview => 'Предпросмотр';

  @override
  String get actionUpload => 'Загрузить';

  @override
  String get actionRefresh => 'Обновить';

  @override
  String get yes => 'Да';

  @override
  String get no => 'Нет';

  @override
  String get errRequired => 'Заполните это поле';

  @override
  String get errBadEmail => 'Неверный email';

  @override
  String get errBadPhone => 'Неверный номер телефона';

  @override
  String get errPasswordShort => 'Пароль должен быть не менее 8 символов';

  @override
  String get errNameShort => 'Имя слишком короткое';

  @override
  String get errBadCode => 'Код состоит из 6 цифр';

  @override
  String get errPasswordMismatch => 'Пароли не совпадают';

  @override
  String get errOffline => 'Нет подключения к интернету';

  @override
  String get errTimeout => 'Сервер не ответил';

  @override
  String get errServer => 'Ошибка сервера';

  @override
  String get errUnauthorized => 'Сессия истекла, войдите снова';

  @override
  String get errForbidden => 'Доступ запрещён';

  @override
  String get errNotFound => 'Не найдено';

  @override
  String get errConflict => 'Эти данные уже заняты';

  @override
  String get errRateLimited => 'Слишком много попыток. Подождите';

  @override
  String get errUnknown => 'Что-то пошло не так';

  @override
  String get errBadCredentials => 'Неверный email или пароль';

  @override
  String get errEmailTaken => 'Этот email уже зарегистрирован';

  @override
  String get errEndpointMissing => 'Эта функция ещё не включена на сервере';

  @override
  String get devBackendRequired => 'BACKEND ENDPOINT REQUIRED';

  @override
  String get devConfigRequired => 'CONFIG REQUIRED';

  @override
  String get stateLoading => 'Загрузка…';

  @override
  String get stateEmpty => 'Пока пусто';

  @override
  String get stateEmptyHint => 'Добавьте первым';

  @override
  String get stateNoResults => 'Ничего не найдено';

  @override
  String get stateNoResultsHint => 'Попробуйте другой запрос';

  @override
  String get stateOfflineTitle => 'Офлайн';

  @override
  String get stateOfflineHint => 'Подключитесь к интернету и повторите';

  @override
  String get stateErrorTitle => 'Произошла ошибка';

  @override
  String get welcomeTitle => 'Ваша цифровая\nличность';

  @override
  String get welcomeSubtitle =>
      'Одним касанием делитесь собой, своим делом и магазином.';

  @override
  String get welcomeLogin => 'Войти';

  @override
  String get welcomeRegister => 'Регистрация';

  @override
  String get loginTitle => 'С возвращением';

  @override
  String get loginSubtitle => 'Введите email и номер телефона';

  @override
  String get loginSubtitlePassword => 'Введите email и пароль';

  @override
  String get fieldEmail => 'Email';

  @override
  String get fieldPhone => 'Телефон';

  @override
  String get fieldPassword => 'Пароль';

  @override
  String get a11yShowPassword => 'Показать пароль';

  @override
  String get a11yHidePassword => 'Скрыть пароль';

  @override
  String get fieldPasswordRepeat => 'Повторите пароль';

  @override
  String get fieldName => 'Имя и фамилия';

  @override
  String get fieldUsername => 'Имя пользователя';

  @override
  String get fieldBio => 'О себе';

  @override
  String get loginSendCode => 'Отправить код';

  @override
  String get loginWithPassword => 'Войти по паролю';

  @override
  String get loginUseCode => 'Войти по коду';

  @override
  String get loginNoAccount => 'Нет аккаунта?';

  @override
  String get loginHaveAccount => 'Уже есть аккаунт?';

  @override
  String get verifyTitle => 'Введите код';

  @override
  String verifySentTo(String email) {
    return '6-значный код отправлен на $email';
  }

  @override
  String verifyResendIn(int seconds) {
    return 'Отправить снова через $seconds с';
  }

  @override
  String get verifyResend => 'Отправить код снова';

  @override
  String get verifyChangeEmail => 'Изменить email';

  @override
  String get verifyWrongCode => 'Неверный код';

  @override
  String get verifyWrongCodeHint => 'Проверьте код и введите снова';

  @override
  String get verifyExpired => 'Срок действия кода истёк';

  @override
  String get verifyExpiredHint => 'Запросите новый код';

  @override
  String get verifySuccess => 'Email подтверждён';

  @override
  String get verifySending => 'Отправляем код…';

  @override
  String get registerTitle => 'Создать аккаунт';

  @override
  String registerStep(int current, int total) {
    return 'Шаг $current из $total';
  }

  @override
  String get registerNameHint => 'Как к вам обращаться?';

  @override
  String get registerEmailHint => 'На этот адрес придёт код подтверждения';

  @override
  String get registerPhoneHint => 'Номер Узбекистана: +998';

  @override
  String get registerPasswordHint => 'Минимум 8 символов';

  @override
  String get setupTitle => 'Заполните профиль';

  @override
  String get setupSubtitle => 'Это можно изменить позже';

  @override
  String get setupSkip => 'Позже';

  @override
  String get setupPhoto => 'Добавить фото';

  @override
  String get logout => 'Выйти';

  @override
  String get logoutConfirm => 'Выйти из аккаунта?';

  @override
  String get navHome => 'Главная';

  @override
  String get navDiscover => 'Обзор';

  @override
  String get navNfc => 'NFC';

  @override
  String get navReels => 'Reels';

  @override
  String get navProfile => 'Профиль';

  @override
  String get homeGreetingMorning => 'Доброе утро';

  @override
  String get homeGreetingDay => 'Добрый день';

  @override
  String get homeGreetingEvening => 'Добрый вечер';

  @override
  String get homeActiveId => 'Активный NFC ID';

  @override
  String get homeNoId => 'NFC ID ещё нет';

  @override
  String get homeNoIdHint => 'Закажите карту в магазине или создайте ID';

  @override
  String get homeQuickActions => 'Быстрые действия';

  @override
  String get homeStories => 'Stories';

  @override
  String get homeYourStory => 'Ваша story';

  @override
  String get homePosts => 'Посты';

  @override
  String get homeReels => 'Reels';

  @override
  String get homeActivity => 'Последние события';

  @override
  String get homeShop => 'Магазин';

  @override
  String get homeBusiness => 'Бизнес';

  @override
  String get modePersonal => 'Личный';

  @override
  String get modeBusiness => 'Бизнес';

  @override
  String modeSwitched(String mode) {
    return 'Переключено на режим «$mode»';
  }

  @override
  String get nfcCenter => 'NFC центр';

  @override
  String get nfcTapToScan => 'Нажмите для сканирования';

  @override
  String get nfcScanShort => 'Сканировать';

  @override
  String get nfcHoldCard => 'Приложите карту к задней части телефона';

  @override
  String get nfcScanning => 'Поиск…';

  @override
  String get nfcScanSuccess => 'Карта прочитана';

  @override
  String get nfcScanFailed => 'Не удалось прочитать карту';

  @override
  String get nfcUnsupported => 'На этом устройстве нет NFC';

  @override
  String get nfcUnsupportedHint => 'Вы можете делиться NFC ID через QR-код';

  @override
  String get nfcDisabled => 'NFC выключен';

  @override
  String get nfcDisabledHint => 'Включите в Настройках → Подключения → NFC';

  @override
  String get nfcOpenSettings => 'Открыть настройки';

  @override
  String get nfcMyIds => 'Мои NFC ID';

  @override
  String get nfcIdDetail => 'Данные ID';

  @override
  String get nfcCards => 'Карты';

  @override
  String get nfcHistory => 'История';

  @override
  String get nfcGift => 'Подарить';

  @override
  String get nfcSecurity => 'Безопасность';

  @override
  String get nfcActive => 'Активен';

  @override
  String get nfcInactive => 'Неактивен';

  @override
  String get nfcSetPrimary => 'Сделать основным';

  @override
  String get nfcPrimary => 'Основной';

  @override
  String get nfcLinkCard => 'Привязать карту';

  @override
  String get nfcBlockCard => 'Заблокировать карту';

  @override
  String get nfcBlockConfirm =>
      'Заблокировать карту? По касанию она перестанет открывать профиль. Позже можно разблокировать.';

  @override
  String get nfcUnblockCard => 'Разблокировать карту';

  @override
  String get nfcDeleteConfirm => 'Удалить этот NFC ID? Действие необратимо.';

  @override
  String get nfcScans => 'Сканирования';

  @override
  String get nfcViews => 'Просмотры';

  @override
  String get bizTaps => 'Нажатия';

  @override
  String get nfcShowQr => 'Показать QR-код';

  @override
  String get nfcQrHint => 'Отсканируйте код, чтобы открыть профиль';

  @override
  String get nfcGiftHint => 'Подарите ID другому пользователю';

  @override
  String get nfcGiftRecipient => 'Email получателя';

  @override
  String get nfcGiftSent => 'Предложение подарка отправлено';

  @override
  String get profileFollowers => 'Подписчики';

  @override
  String get profileFollowing => 'Подписки';

  @override
  String get profilePosts => 'Посты';

  @override
  String get profileEdit => 'Редактировать профиль';

  @override
  String get profileLinks => 'Ссылки';

  @override
  String get profileContact => 'Контакты';

  @override
  String get profileSaved => 'Профиль сохранён';

  @override
  String get profileNoBio => 'Описание не добавлено';

  @override
  String get discoverTitle => 'Обзор';

  @override
  String get discoverPeople => 'Люди';

  @override
  String get discoverBusinesses => 'Бизнесы';

  @override
  String get discoverProducts => 'Товары';

  @override
  String get discoverTrending => 'Популярное';

  @override
  String get discoverSuggested => 'Рекомендуем';

  @override
  String get searchHint => 'Человек, бизнес или NFC ID';

  @override
  String get searchRecent => 'Недавние запросы';

  @override
  String get searchClear => 'Очистить';

  @override
  String get storyCreate => 'Добавить story';

  @override
  String get storyDeleteConfirm => 'Удалить эту story?';

  @override
  String get postCreate => 'Добавить пост';

  @override
  String get postCaption => 'Напишите описание…';

  @override
  String get postComments => 'Комментарии';

  @override
  String get postNoComments => 'Комментариев нет';

  @override
  String get postAddComment => 'Оставьте комментарий…';

  @override
  String get postLiked => 'Нравится';

  @override
  String get postSave => 'Сохранить';

  @override
  String get postDeleteConfirm => 'Удалить этот пост?';

  @override
  String get reelCreate => 'Добавить reel';

  @override
  String get storyPublish => 'Опубликовать story';

  @override
  String get postPublish => 'Опубликовать пост';

  @override
  String get reelPublish => 'Опубликовать reel';

  @override
  String get storyLike => 'Нравится';

  @override
  String get storyComments => 'Комментарии';

  @override
  String get storyCommentHint => 'Напишите комментарий…';

  @override
  String get reelsEmpty => 'Reels пока нет';

  @override
  String uploadProgress(int percent) {
    return 'Загрузка $percent%';
  }

  @override
  String get uploadFailed => 'Не удалось загрузить';

  @override
  String get mediaPickPhoto => 'Выбрать фото';

  @override
  String get mediaPickVideo => 'Выбрать видео';

  @override
  String get mediaCamera => 'Камера';

  @override
  String get mediaGallery => 'Галерея';

  @override
  String get bizTitle => 'Бизнес';

  @override
  String get bizDashboard => 'Панель управления';

  @override
  String get bizStorefront => 'Витрина';

  @override
  String get bizCatalog => 'Каталог';

  @override
  String get bizAnalytics => 'Аналитика';

  @override
  String get bizCreate => 'Создать бизнес';

  @override
  String get bizNone => 'У вас нет бизнес-аккаунта';

  @override
  String get bizNoneHint => 'Откройте компанию за несколько шагов';

  @override
  String get bizId => 'Адрес бизнеса';

  @override
  String get bizIdHint => 'nfcstore.uz/c/ваше-имя';

  @override
  String get bizIdChecking => 'Проверяем…';

  @override
  String get bizIdFree => 'Свободно';

  @override
  String get bizIdTaken => 'Занято';

  @override
  String get bizName => 'Название компании';

  @override
  String get bizCategory => 'Категория';

  @override
  String get bizCity => 'Город';

  @override
  String get bizAddress => 'Адрес';

  @override
  String get bizDescription => 'Описание';

  @override
  String get bizWebsite => 'Веб-сайт';

  @override
  String get bizHours => 'Часы работы';

  @override
  String get bizContactSheet => 'Связаться';

  @override
  String get bizProducts => 'Товары';

  @override
  String get bizServices => 'Услуги';

  @override
  String get bizAddProduct => 'Добавить товар';

  @override
  String get bizProductName => 'Название';

  @override
  String get bizPrice => 'Цена';

  @override
  String get bizSalePrice => 'Цена со скидкой';

  @override
  String get bizAvailable => 'В наличии';

  @override
  String get bizUnavailable => 'Нет в наличии';

  @override
  String get bizCatalogEmpty => 'Каталог пуст';

  @override
  String get bizSubmitReview => 'Отправить на модерацию';

  @override
  String get bizPending => 'На модерации';

  @override
  String get shopTitle => 'Магазин';

  @override
  String get shopAll => 'Все';

  @override
  String get shopCards => 'NFC карты';

  @override
  String get shopIds => 'NFC ID';

  @override
  String get shopBuy => 'Заказать';

  @override
  String get shopSoldOut => 'Нет в продаже';

  @override
  String get checkoutTitle => 'Оформление заказа';

  @override
  String get checkoutTotal => 'Итого';

  @override
  String get checkoutPayWith => 'Способ оплаты';

  @override
  String get checkoutPlace => 'Перейти к оплате';

  @override
  String get paymentPending => 'Ожидание оплаты';

  @override
  String get paymentPendingHint =>
      'Завершите оплату — результат появится здесь';

  @override
  String get paymentSuccess => 'Оплата прошла успешно';

  @override
  String get paymentFailed => 'Оплата не прошла';

  @override
  String get paymentCancelled => 'Оплата отменена';

  @override
  String get paymentNotConfigured => 'Платёжная система не настроена';

  @override
  String get orders => 'Заказы';

  @override
  String get ordersEmpty => 'Заказов нет';

  @override
  String orderNumber(String id) {
    return 'Заказ №$id';
  }

  @override
  String get paymentHistory => 'История платежей';

  @override
  String get activityTitle => 'Уведомления';

  @override
  String get activityEmpty => 'Новых уведомлений нет';

  @override
  String get activityMarkRead => 'Отметить все как прочитанные';

  @override
  String get activityAll => 'Все';

  @override
  String get activityUnread => 'Непрочитанные';

  @override
  String get settings => 'Настройки';

  @override
  String get settingsAccount => 'Аккаунт';

  @override
  String get settingsSecurity => 'Безопасность';

  @override
  String get settingsChangePassword => 'Сменить пароль';

  @override
  String get settingsCurrentPassword => 'Текущий пароль';

  @override
  String get settingsNewPassword => 'Новый пароль';

  @override
  String get settingsPasswordChanged => 'Пароль изменён';

  @override
  String get settingsAppearance => 'Оформление';

  @override
  String get settingsTheme => 'Тема';

  @override
  String get settingsLanguage => 'Язык';

  @override
  String get settingsNotifications => 'Уведомления';

  @override
  String get settingsPrivacy => 'Приватность';

  @override
  String get settingsPayment => 'Оплата';

  @override
  String get settingsReferral => 'Реферальная программа';

  @override
  String get settingsReferralHint =>
      'Если друг зарегистрируется по вашему коду, скидку получите оба';

  @override
  String get settingsPremium => 'Premium';

  @override
  String get settingsSupport => 'Поддержка';

  @override
  String get settingsNews => 'Новости';

  @override
  String get settingsAbout => 'О приложении';

  @override
  String settingsVersion(String version) {
    return 'Версия $version';
  }

  @override
  String get settingsDeleteAccount => 'Удалить аккаунт';

  @override
  String get settingsDeleteConfirm =>
      'Аккаунт будет удалён навсегда. Действие необратимо.';

  @override
  String get settingsDeleteTypeEmail => 'Введите свой email для подтверждения';

  @override
  String get themePearl => 'Жемчуг';

  @override
  String get themeGraphite => 'Графит';

  @override
  String get themeOcean => 'Океан';

  @override
  String get themeAurora => 'Аврора';

  @override
  String get themeMidnight => 'Полночь';

  @override
  String get langUz => 'Узбекский';

  @override
  String get langRu => 'Русский';

  @override
  String get langEn => 'Английский';

  @override
  String get supportWriteUs => 'Напишите нам';

  @override
  String get supportSent => 'Обращение отправлено';

  @override
  String get musicTitle => 'Музыка';

  @override
  String get musicFailed => 'Не удалось открыть трек';

  @override
  String get rulesTitle => 'Прочитайте перед публикацией';

  @override
  String get rulesBody =>
      'Размещаемый контент не должен содержать: религиозную пропаганду или экстремистские материалы, порнографические изображения или материалы сексуального характера, политическую пропаганду, а также любые материалы, противоречащие законодательству Республики Узбекистан. При нарушении этих правил контент удаляется без предупреждения.';

  @override
  String get rulesAccept => 'Я прочитал(а) правила и согласен(на)';

  @override
  String get rulesContinue => 'Продолжить';

  @override
  String get rulesReminder => 'Публикуя, вы соглашаетесь с правилами контента.';

  @override
  String get rulesOpen => 'Правила контента';

  @override
  String get rulesNotAccepted => 'Согласие с правилами контента не получено.';

  @override
  String get reportTitle => 'Пожаловаться';

  @override
  String get reportSent => 'Жалоба отправлена';

  @override
  String get reportReasonPorn => 'Порнография или сексуальный контент';

  @override
  String get reportReasonReligious => 'Религиозная пропаганда или экстремизм';

  @override
  String get reportReasonPolitical => 'Политическая пропаганда';

  @override
  String get reportReasonViolence => 'Насилие или жестокость';

  @override
  String get reportReasonInsult => 'Оскорбление или унижение';

  @override
  String get reportReasonSpam => 'Спам или обман';

  @override
  String get reportReasonIllegal => 'Незаконный материал';

  @override
  String get reportReasonCopyright => 'Авторское право';

  @override
  String get reportReasonOther => 'Другое';

  @override
  String get reportNote => 'Комментарий (необязательно)';

  @override
  String get blockUser => 'Заблокировать';

  @override
  String get unblockUser => 'Разблокировать';

  @override
  String get blockedList => 'Заблокированные';

  @override
  String get lockTitle => 'Блокировка приложения';

  @override
  String get lockHint => 'Введите PIN-код';

  @override
  String get lockWrong => 'Неверный PIN';

  @override
  String get lockSetPin => 'Новый PIN-код';

  @override
  String get lockRepeatPin => 'Повторите PIN-код';

  @override
  String get lockMismatch => 'PIN-коды не совпали';

  @override
  String get lockEnabled => 'Блокировка включена';

  @override
  String get lockBiometricReason => 'Открыть NFCSTORE';

  @override
  String get lockBiometric => 'Разблокировка биометрией';

  @override
  String get lockBiometricNone => 'На этом устройстве нет биометрии';

  @override
  String get lockOff => 'Выключить блокировку';

  @override
  String get lockDesc =>
      'Требует PIN при открытии приложения на этом устройстве. Это не пароль аккаунта.';

  @override
  String get actionSend => 'Отправить';

  @override
  String get giftOffers => 'Предложения подарков';

  @override
  String get giftIncoming => 'Вам предложено';

  @override
  String get giftOutgoing => 'Вы отправили';

  @override
  String get giftAccept => 'Принять';

  @override
  String get giftReject => 'Отклонить';

  @override
  String get giftCancel => 'Отменить';

  @override
  String get giftNoOffers => 'Пока нет предложений подарков';

  @override
  String get profilePickBusiness => 'Выберите бизнес-профиль';

  @override
  String get profilePickPersonal => 'Выберите личный профиль';

  @override
  String get businessNoneTitle => 'У вас нет бизнес-профиля';

  @override
  String get businessNoneHint =>
      'Создайте бизнес-профиль или вернитесь в личный режим';
}
