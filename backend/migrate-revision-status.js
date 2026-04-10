#!/usr/bin/env node
/**
 * Миграция: добавить 'revision' в CHECK constraint на статусы
 * 
 * В PostgreSQL CHECK constraint нельзя просто обновить — нужно:
 * 1. Удалить старый constraint
 * 2. Создать новый с расширенным списком значений
 */

import db from './db.js';

const TABLES = [
  { name: 'posts', idCol: 'id' },
  { name: 'markers', idCol: 'id' },
  { name: 'routes', idCol: 'id' },
  { name: 'events', idCol: 'id' },
  { name: 'blogs', idCol: 'id' },
];

const ALLOWED_STATUSES = ['pending', 'active', 'rejected', 'revision', 'hidden'];

async function migrateTable(table, idCol) {
  console.log(`\n📋 Мигрируем таблицу: ${table}`);
  
  try {
    // 1. Проверяем, есть ли колонка status
    const colCheck = await db.query(
      `SELECT EXISTS(SELECT 1 FROM information_schema.columns 
       WHERE table_name = $1 AND column_name = 'status')`,
      [table]
    );
    
    if (!colCheck.rows[0].exists) {
      console.log(`   ⏭️  Колонка 'status' не найдена в ${table}`);
      return;
    }
    
    console.log(`   ✅ Колонка 'status' есть`);
    
    // 2. Ищем текущий CHECK constraint НА СТАТУСЕ
    const constraintCheck = await db.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = $1 AND constraint_type = 'CHECK' AND constraint_name LIKE '%status%'
      LIMIT 1
    `, [table]);
    
    if (constraintCheck.rows.length === 0) {
      console.log(`   ℹ️  CHECK constraint на status не найден — может быть создан динамически`);
      
      // Пробуем добавить ограничение
      try {
        await db.query(
          `ALTER TABLE ${table} 
           ADD CONSTRAINT ${table}_status_check 
           CHECK (status IN (${ALLOWED_STATUSES.map(s => `'${s}'`).join(', ')}))`
        );
        console.log(`   ✅ Добавлен новый CHECK constraint`);
      } catch (err) {
        if (err.code === '42P07') { // duplicate_object
          console.log(`   ⚠️  Constraint уже существует`);
        } else {
          throw err;
        }
      }
      return;
    }
    
    const constraintName = constraintCheck.rows[0].constraint_name;
    console.log(`   Found constraint: ${constraintName}`);
    
    // Проверяем определение constraint'a через pg_get_constraintdef
    const constraintDef = await db.query(
      `SELECT pg_get_constraintdef(c.oid) as constraint_def
       FROM pg_constraint c
       JOIN pg_class t ON c.conrelid = t.oid
       WHERE t.relname = $1 AND c.conname = $2`,
      [table, constraintName]
    );
    
    let definition = '';
    if (constraintDef.rows.length > 0) {
      definition = constraintDef.rows[0].constraint_def;
      console.log(`   Current definition: ${definition}`);
    }
    
    // Проверяем, содержит ли уже 'revision'
    if (definition.includes('revision')) {
      console.log(`   ✅ В constraint уже есть 'revision' — ничего не делаем`);
      return;
    }
    
    // 3. Удаляем старый constraint
    console.log(`   🗑️  Удаляем старый constraint: ${constraintName}`);
    await db.query(
      `ALTER TABLE ${table} DROP CONSTRAINT ${constraintName}`
    );
    
    // 4. Создаём новый с 'revision'
    const newConstraintName = `${table}_status_check`;
    const statusList = ALLOWED_STATUSES.map(s => `'${s}'`).join(', ');
    const newConstraintRule = `status IN (${statusList})`;
    
    console.log(`   ➕ Добавляем новый constraint: ${newConstraintName}`);
    console.log(`   ✅ Новое правило: ${newConstraintRule}`);
    
    await db.query(
      `ALTER TABLE ${table} 
       ADD CONSTRAINT ${newConstraintName} 
       CHECK (${newConstraintRule})`
    );
    
    console.log(`   ✅ УСПЕШНО мигрирована`);
    
  } catch (err) {
    console.error(`   ❌ ОШИБКА в ${table}:`, err.message);
    throw err;
  }
}

async function main() {
  console.log('🚀 Запуск миграции untuk поддержки revision статуса...');
  
  try {
    for (const table of TABLES) {
      await migrateTable(table.name, table.idCol);
    }
    
    console.log('\n✅ Миграция завершена успешно!');
    console.log(`   Теперь доступны статусы: ${ALLOWED_STATUSES.join(', ')}`);
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Миграция провалилась:', err);
    process.exit(1);
  }
}

main();
