# План реализации дизайн-концепта GigaCode Harness

Источник направления: сгенерированный UI-концепт в стиле темного стеклянного рабочего пульта с черной базой, оранжевым ключевым акцентом, мягкими бликами, левым навигационным блоком, центральной рабочей областью и правой панелью статуса.

## Цель

Перевести текущий интерфейс из простого набора панелей в цельный рабочий dashboard для GigaCode Harness: визуально футуристичный, но практичный, без декоративной перегрузки и без потери читаемости.

Ключевой визуальный язык:

- графитовая/черная база;
- стеклянные панели с blur, прозрачностью и тонкими контурами;
- оранжевый как основной action/status accent;
- небольшие холодные индикаторы только для вторичных статусов;
- плотная, инженерная компоновка вместо лендинговой подачи.

## Компонентов Не Хватает

### 1. Shell Layout

Нужен отдельный layout-слой, который задает не просто `sidebar + workspace`, а полноценную сцену:

- фон с тонкой сеткой и направленным оранжевым светом;
- левый вертикальный light-strip;
- общий glass-frame для рабочей области;
- стабильные размеры панелей и отступов;
- единые токены для surfaces, borders, shadows, glow.

Сейчас это почти полностью завязано на один `styles.css`, без явных семантических уровней поверхности.

### 2. Workspace Dashboard Header

Текущий `Topbar` слишком простой. Нужен header, который работает как статусная шапка:

- название активного раздела;
- краткий live-status GigaCode/home;
- кнопка refresh как primary action;
- компактные индикаторы: chats, skills, worktrees, active run;
- визуальное разделение между глобальной шапкой и содержимым вкладки.

### 3. Chat List Item

Карточка чата должна стать самостоятельным компонентом, а не inline-разметкой внутри `ChatsView`:

- title обычным весом, без жирного;
- дата/время обновления;
- статус последнего события, если доступен;
- тонкий active marker слева;
- hover/focus/selected состояния;
- ограничение длинных названий без скачков layout.

Проект/имя файла в списке чатов показывать не нужно. Полный путь можно оставить только в detail header или раскрываемом metadata-блоке.

### 4. Conversation Surface

Нужна отдельная визуальная система для чата:

- центральная glass-панель с большим рабочим полем;
- роли сообщений как компактные chips;
- разные, но спокойные стили для user/assistant/system/error;
- pinned status/thinking panel;
- compose bar как нижняя командная строка.

Сейчас сообщения выглядят функционально, но не как часть цельного cockpit-интерфейса.

### 5. Right Rail / Inspector Panel

В концепте есть правая панель статуса. В текущем UI ее нет.

Возможное содержимое:

- выбранный чат: путь, id, update time;
- текущий run status;
- последние события thinking/SSE;
- health backend/GigaCode;
- быстрые метрики по проекту.

Для вкладок `skills`, `worktrees`, `run` правый rail может показывать контекстные свойства выбранного объекта.

### 6. Bottom Command / Activity Rail

Не хватает нижнего служебного слоя:

- текущий cwd/project context;
- last refresh time;
- backend health;
- active task/run indicator;
- компактные действия вроде stop/open logs.

Этот rail должен быть маленьким и не конкурировать с основным контентом.

### 7. Status Widgets

Текущие счетчики в sidebar слишком статичные. Нужны компактные виджеты:

- health chip;
- count widgets;
- last sync/update;
- run state: idle/running/error;
- optional small pulse для активного процесса.

### 8. Design Tokens

Нужны явные CSS tokens:

- colors: `--color-bg`, `--color-panel`, `--color-accent`, `--color-text`, `--color-muted`;
- borders: `--border-subtle`, `--border-accent`;
- radii: `--radius-panel`, `--radius-control`;
- shadows/glows;
- spacing scale;
- typography scale.

Без этого следующие итерации дизайна будут ломать друг друга.

## Что Нужно Добавить

### Этап 1. Зафиксировать UI Architecture

Добавить или выделить компоненты:

- `AppShell`
- `WorkspaceHeader`
- `GlassPanel`
- `StatusChip`
- `MetricTile`
- `ChatListItem`
- `InspectorRail`
- `ActivityRail`

На первом этапе можно оставить данные прежними и менять только разметку/слои.

### Этап 2. Пересобрать Chats View

Целевая структура:

- слева список чатов;
- в центре conversation surface;
- справа inspector с деталями выбранного чата;
- снизу compose/activity area.

Нужно сохранить текущее поведение:

- открытие чата;
- продолжение чата;
- stop run;
- thinking events;
- auto-scroll.

### Этап 3. Унифицировать Остальные Вкладки

`SkillsView`, `WorktreesView`, `RunView` должны использовать те же surface-компоненты:

- list/detail split;
- toolbar в едином стиле;
- table rows как glass rows;
- empty states без тяжелой декоративности.

### Этап 4. Добавить Micro-States

Обязательные состояния:

- loading;
- empty;
- selected;
- hover;
- focus-visible;
- disabled;
- error;
- running;
- stopped.

Особенно важно проверить keyboard focus, потому что темное стекло легко делает фокус невидимым.

### Этап 5. Подготовить Визуальные Режимы

Основной режим можно сделать темным cockpit-style из концепта. Светлый режим оставить позже как опциональный, если нужен.

Минимальный набор:

- `dark-glass` как основной;
- CSS variables так, чтобы позже добавить `light-glass` без переписывания компонентов.

## Что Нужно Измерить

### Layout

- нет горизонтального overflow на `390px`, `768px`, `1280px`, `1440px`;
- список чатов не меняет ширину при длинных title;
- compose bar не перекрывает сообщения;
- inspector rail не сжимает conversation ниже удобной ширины;
- высота viewport используется без лишней прокрутки desktop layout.

### Readability

- контраст текста на стеклянных поверхностях;
- читаемость muted text;
- читаемость message body в `pre`;
- видимость active/selected/focus states;
- читаемость на светлом и темном фоне, если останутся оба режима.

### Interaction

- время открытия чата визуально не ощущается пустым;
- auto-scroll работает после новых сообщений;
- stop button виден только во время run;
- disabled actions выглядят disabled, но не исчезают;
- error state не ломает layout.

### Data Density

- сколько строк чатов помещается на 720px высоты;
- сколько сообщений видно без скролла;
- не становится ли right rail шумным;
- не теряются ли важные действия из-за декоративных слоев.

### Performance

- blur/backdrop-filter не просаживает scroll;
- большие chat logs не вызывают заметных лагов;
- CSS effects не создают лишние repaint на hover/scroll;
- build size после разбиения компонентов.

### Accessibility

- keyboard navigation по nav/list/buttons/forms;
- `focus-visible` на всех интерактивных элементах;
- readable labels для кнопок;
- contrast ratio для текста и controls;
- reduced-motion fallback для glow/pulse эффектов.

## Риски

- Слишком сильный glass/blur может ухудшить читаемость.
- Оранжевый акцент легко станет навязчивым, если использовать его на каждом элементе.
- Правый inspector может перегрузить первый экран, если не ограничить его полезными данными.
- Если начать с CSS без компонентной структуры, дизайн снова станет сложно поддерживать.

## Предлагаемый Порядок Работы

1. Вынести design tokens в начало CSS.
2. Добавить базовые surface-компоненты без изменения поведения.
3. Пересобрать `ChatsView` под `list + conversation + inspector`.
4. Проверить desktop/mobile layout.
5. Перенести общие элементы на `SkillsView`, `WorktreesView`, `RunView`.
6. Добавить focus/loading/error/running states.
7. Провести финальный визуальный прогон в браузере и build.

## Definition of Done

- Интерфейс визуально близок к концепту: черная стеклянная рабочая среда с оранжевым акцентом.
- Все текущие функции работают без изменения API.
- Список чатов показывает title обычным весом и дату, без projectName и без file name.
- Desktop и mobile не имеют горизонтального overflow.
- `npm.cmd run build` проходит.
- Основные состояния интерфейса визуально различимы.
