# Lovelace для MajorDoMo

Панель управления умным домом в стиле Home Assistant Lovelace — модуль для [MajorDoMo](https://github.com/sergejey/majordomo).
Vanilla JS без сборки и внешних CDN, работает в локальной сети и на Android (Termux).

> Ветка `alpha` — разработка. Стабильная версия — `main`.

## Возможности

- Комнаты-вкладки с карточками устройств, визуальный редактор раскладки.
- Раскладка хранится в БД на каждого пользователя; без своей — используется общая (`USER_ID=0`).
- Живые обновления через WebSocket MajorDoMo, опрос API как резерв.
- Восемь цветовых тем, опциональная синхронизация темы через БД.
- Киоск-режим для настенных устройств по токену (просмотр или управление).
- «Запомнить устройство» — персональный токен на 30 дней.
- Демо-данные, если API недоступен.
- Карточки — подключаемые плагины.

## Установка

1. Скопировать `modules/`, `templates/` и `img/` в корень MajorDoMo.
2. Открыть модуль в панели управления — при первом обращении он регистрируется и создаёт таблицы.

Требования: MajorDoMo с маршрутом `api.php/module/<name>/`, MySQL/MariaDB с поддержкой `utf8mb4`.

## Структура

```
modules/lovelace/lovelace.class.php   модуль: страница, API, установка таблиц
templates/lovelace/lovelace.html      страница модуля (iframe с панелью)
templates/lovelace/index.html         панель: движок, редактор, темы, WebSocket
templates/lovelace/cards/index.json   манифест карточек
templates/lovelace/cards/*.js         карточки-плагины
img/modules/lovelace.png              иконка модуля
```

## Доступ

| Режим | Как | Права |
|---|---|---|
| Сессия | обычный вход в MajorDoMo | своя раскладка; админ — любая |
| Устройство | `dev`-токен в `localStorage`, выдаётся автоматически | как у пользователя, 30 дней с продлением |
| Киоск | `index.html?token=<токен>` | раскладка привязанного пользователя; управление — если разрешено токеном |

Киоск-токены создаёт и отзывает администратор в настройках панели.

## Безопасность записи

Запись свойств (`set`) и вызов методов (`method`) разрешены только для того, что есть в раскладке:
сервер строит белые списки из карточек (`prop`, `target`, `method`, `actions`, а также `writes`/`methods` плагинов).
Значения приводятся к типу (`bool`, число с `min`/`max`), запись идёт через `sg()` — срабатывают методы, сценарии и история.

## API

`api.php/module/lovelace/<op>` — параметры в query или JSON-теле.

| op | Назначение | Токен киоска |
|---|---|---|
| `checkAuth` | статус авторизации (без входа) | да |
| `state` | раскладка со значениями свойств | да |
| `config` / `save` | чтение / сохранение раскладки (`user` — для админа) | только `config` |
| `set` | `object`, `property`, `value` | при `CAN_CONTROL` |
| `method` | `object`, `method` | при `CAN_CONTROL` |
| `objects`, `properties`, `objectinfo`, `discover` | данные для редактора | — |
| `calendar` | события; `op=add\|update\|delete` | только чтение |
| `settings` / `savesettings` | внешний WS-адрес (`savesettings` — админ) | только `settings` |
| `prefs` / `saveprefs` | настройки пользователя (тема) | — |
| `device_forget` | удалить токен устройства | — |
| `users`, `tokens`, `token_create`, `token_revoke` | управление киоск-токенами (админ) | — |

## Карточки

| Тип | Назначение |
|---|---|
| `switch` | тумблер |
| `slider` | ползунок |
| `sensor` | значение + график истории |
| `text` | текстовое значение |
| `button` | вызов метода |
| `thermostat` | текущая и целевая температура |
| `cover` | шторы (методы) |
| `rgb` | питание + цвет |
| `light` | лампа: яркость, температура, цвет в разных форматах |
| `gauge` | круговой индикатор |
| `camera` | снапшот из свойства |
| `webrtc` | камера go2rtc: снапшот и поток HD/SD |
| `weather` | погода (модуль Яндекс-погоды) |
| `calendar` | общий календарь событий |
| `clock` | часы, аналоговые и цифровые |
| `spacer` | пустая карточка-распорка |

### Своя карточка

Создать `cards/<type>.js` и добавить имя файла в `cards/index.json`. Ядро и API не меняются.

```js
(function () {
  var L = window.Lovelace; if (!L) return;
  L.util.css(".my{font-size:14px}");
  L.register("mytype", {
    fields: [{k: "prop", l: "Свойство", t: "prop"}],          // поля редактора
    reads:  function (c) { return c.prop ? [c.prop] : []; },  // сервер вернёт c.values[prop]
    render: function (dev, c, ctx) {
      return '<div class="my">' + ctx.esc(L.util.V(c, c.prop)) + '</div>';
    }
  });
})();
```

| Ключ | Описание |
|---|---|
| `fields` | поля редактора `{k, l, t, o}`; `t`: `text`, `num`, `prop`, `select`, `seg` |
| `reads` | свойства для чтения → `c.values`; массив или `function(c)` |
| `writes`, `methods` | что разрешить писать/вызывать (белый список); массив или `function(c)` |
| `render(dev, c, ctx)` | HTML-строка; `ctx`: `esc`, `svg`, `truthy`, `normHex` |
| `bind(el, dev, c, api)` | обработчики; `api`: `postSet`, `postMethod`, `flash`, `refresh`, `openChart`, `openColor`, `openWebrtc` |
| `noObject` | карточке не нужен объект MajorDoMo |
| `noHeader` | без шапки |

Хелперы: `L.util.V(c, prop)` — значение свойства, `L.util.tru(v)` — истинность, `L.util.css(text)` — стили карточки.

## Таблицы

| Таблица | Содержимое |
|---|---|
| `lovelace_config` | раскладка (`DATA`) и настройки (`PREFS`) пользователя |
| `lovelace_calendar` | события календаря |
| `lovelace_tokens` | киоск-токены |
| `lovelace_devices` | токены «запомнить устройство» |
