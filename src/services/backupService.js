
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import logger from '../config/logger.js';

export const createDatabaseBackup = async () => {
  try {
    const backupDir = path.join(process.cwd(), 'backups');
    await fs.mkdir(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);

    const databaseUrl = process.env.DATABASE_URL;
    const urlParts = new URL(databaseUrl);
    
    const pgDumpArgs = [
      '-h', urlParts.hostname,
      '-p', urlParts.port || '5432',
      '-U', urlParts.username,
      '-d', urlParts.pathname.slice(1),
      '-f', backupFile,
      '--verbose',
      '--clean',
      '--no-owner',
      '--no-privileges'
    ];

    return new Promise((resolve, reject) => {
      const pgDump = spawn('pg_dump', pgDumpArgs, {
        env: { ...process.env, PGPASSWORD: urlParts.password }
      });

      pgDump.on('close', (code) => {
        if (code === 0) {
          logger.info(`Database backup created: ${backupFile}`);
          resolve(backupFile);
        } else {
          reject(new Error(`pg_dump exited with code ${code}`));
        }
      });

      pgDump.on('error', (error) => {
        reject(error);
      });
    });

  } catch (error) {
    logger.error('Error creating database backup:', error);
    throw error;
  }
};

export const restoreDatabaseBackup = async (backupFile) => {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    const urlParts = new URL(databaseUrl);
    
    const psqlArgs = [
      '-h', urlParts.hostname,
      '-p', urlParts.port || '5432',
      '-U', urlParts.username,
      '-d', urlParts.pathname.slice(1),
      '-f', backupFile,
      '--verbose'
    ];

    return new Promise((resolve, reject) => {
      const psql = spawn('psql', psqlArgs, {
        env: { ...process.env, PGPASSWORD: urlParts.password }
      });

      psql.on('close', (code) => {
        if (code === 0) {
          logger.info(`Database restored from: ${backupFile}`);
          resolve(true);
        } else {
          reject(new Error(`psql exited with code ${code}`));
        }
      });

      psql.on('error', (error) => {
        reject(error);
      });
    });

  } catch (error) {
    logger.error('Error restoring database backup:', error);
    throw error;
  }
};

export const cleanupOldBackups = async (maxAge = 30) => {
  try {
    const backupDir = path.join(process.cwd(), 'backups');
    const files = await fs.readdir(backupDir);
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAge);

    for (const file of files) {
      if (file.endsWith('.sql')) {
        const filePath = path.join(backupDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          logger.info(`Deleted old backup: ${file}`);
        }
      }
    }

  } catch (error) {
    logger.error('Error cleaning up old backups:', error);
    throw error;
  }
};
