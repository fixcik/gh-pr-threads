#!/bin/bash
set -e

echo "🔍 Верификация pr-comment-fetcher"
echo "=================================="
echo ""

echo "✅ Проверка структуры проекта..."
test -f package.json
test -f tsconfig.json
test -f README.md
test -f CHANGELOG.md
test -f CONTRIBUTING.md
test -f EXAMPLES.md
test -d src
test -f src/index.ts
test -f src/cli.ts
test -f src/types.ts

echo "✅ Установка зависимостей..."
npm install --silent

echo "✅ Сборка проекта..."
npm run build --silent

echo "✅ Проверка собранных файлов..."
test -f dist/index.js
test -f dist/cli.js
test -f dist/types.js
test -x dist/index.js

echo "✅ Проверка CLI команд..."
node dist/index.js --version | grep -q "1.0.0"
node dist/index.js --help | grep -q "pr-comment-fetcher"

echo ""
echo "🎉 Все проверки пройдены успешно!"
echo ""
echo "Для публикации выполните:"
echo "  npm publish"
echo ""
echo "Для локального тестирования:"
echo "  npm link"
echo "  pr-comment-fetcher --help"
