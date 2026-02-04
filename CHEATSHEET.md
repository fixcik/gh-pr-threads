# pr-comment-fetcher - Шпаргалка

## Установка и запуск

```bash
# После публикации
npx pr-comment-fetcher <PR_URL>

# Локально (прямо сейчас)
~/projects/ai/pr-comment-fetcher/dist/index.js <PR_URL>

# npm link для глобального использования
cd ~/projects/ai/pr-comment-fetcher
npm link
pr-comment-fetcher <PR_URL>
```

## Основные команды

```bash
# Help
pr-comment-fetcher --help

# Версия
pr-comment-fetcher --version

# Автоопределение PR (в git repo)
pr-comment-fetcher

# С конкретным URL
pr-comment-fetcher https://github.com/owner/repo/pull/123
```

## Фильтры (--only)

```bash
--only=threads        # Review threads
--only=nitpicks       # Nitpicks от CodeRabbit
--only=summaries      # Bot summaries
--only=files          # Изменённые файлы
--only=userComments   # Комментарии пользователей

# Комбинация
--only=threads,nitpicks,files
```

## Опции

```bash
--all              # Включить resolved threads
--include-done     # Включить done/skip статусы
```

## Частые сценарии

```bash
# 1. Все нерешённые комментарии
pr-comment-fetcher <URL> --only=threads

# 2. Только комментарии от людей (не ботов)
pr-comment-fetcher <URL> --only=userComments

# 3. Все nitpicks от CodeRabbit
pr-comment-fetcher <URL> --only=nitpicks

# 4. Полная информация
pr-comment-fetcher <URL>

# 5. Включая обработанные
pr-comment-fetcher <URL> --include-done
```

## Обработка с jq

```bash
# Только summary
pr-comment-fetcher <URL> | jq '.summary'

# Количество комментариев по авторам
pr-comment-fetcher <URL> --only=userComments | jq '.summary.userCommentsByAuthor'

# Список нерешённых файлов
pr-comment-fetcher <URL> --only=threads | \
  jq -r '.threads[] | select(.isResolved == false) | .path' | sort -u

# Все nitpicks для файла
pr-comment-fetcher <URL> --only=nitpicks | \
  jq '.botSummaries[].nitpicks[] | select(.path == "src/index.ts")'
```

## Состояние

Файл: `~/.cursor/reviews/{owner}-{repo}-{number}/pr-state.json`

```json
{
  "threads": {
    "thread-id": { "status": "done", "note": "Fixed" }
  },
  "nitpicks": {
    "file.ts:42": { "status": "skip", "note": "Won't fix" }
  }
}
```

Статусы: `done`, `skip`, или отсутствует

## Разработка

```bash
# Установка
npm install

# Dev режим
npm run dev -- <PR_URL> [options]

# Сборка
npm run build

# Верификация
./verify.sh

# Публикация
npm publish
```

## Файлы проекта

```
README.md          - Полная документация
QUICKSTART.md      - Быстрый старт
EXAMPLES.md        - Примеры использования
CHEATSHEET.md      - Эта шпаргалка
PROJECT_SUMMARY.md - Детали реализации
CHANGELOG.md       - История версий
CONTRIBUTING.md    - Для контрибьюторов
```

## Tips

💡 Используйте `--only` для ускорения (меньше GraphQL запросов)
💡 Состояние сохраняется автоматически
💡 `--include-done` покажет что уже обработано
💡 jq - ваш друг для обработки JSON
💡 Можно запускать без аргументов в git repo с PR
