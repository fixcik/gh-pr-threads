# Quick Start

## Использование (после публикации)

```bash
npx pr-comment-fetcher https://github.com/owner/repo/pull/123
```

## Локальное тестирование (прямо сейчас)

```bash
# Из любой директории с git репозиторием и открытым PR
~/projects/ai/pr-comment-fetcher/dist/index.js --only=userComments

# Или с URL
~/projects/ai/pr-comment-fetcher/dist/index.js https://github.com/owner/repo/pull/123
```

## Установка для разработки

```bash
cd ~/projects/ai/pr-comment-fetcher
npm install
npm run build
```

## Быстрый тест

```bash
# Запустить верификацию
./verify.sh

# Показать help
node dist/index.js --help

# Получить версию
node dist/index.js --version
```

## Публикация в NPM

```bash
# 1. Убедитесь что всё работает
./verify.sh

# 2. Обновите package.json (repository URLs)

# 3. Создайте git репозиторий
git init
git add .
git commit -m "Initial release v1.0.0"

# 4. Опубликуйте
npm login
npm publish

# 5. Используйте
npx pr-comment-fetcher --help
```

## Примеры использования

```bash
# Только комментарии пользователей
pr-comment-fetcher <PR_URL> --only=userComments

# Только nitpicks от CodeRabbit
pr-comment-fetcher <PR_URL> --only=nitpicks

# Все треды включая resolved
pr-comment-fetcher <PR_URL> --only=threads --all

# Показать статистику
pr-comment-fetcher <PR_URL> | jq '.summary'
```

Подробнее смотрите в:
- **README.md** - полная документация
- **EXAMPLES.md** - больше примеров с jq
- **PROJECT_SUMMARY.md** - детали реализации
