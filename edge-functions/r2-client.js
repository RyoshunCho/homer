/**
 * R2 Client Module for Cloudflare R2 S3-compatible API
 * Handles config.yml read/write operations with backup management
 */

import { AwsClient } from 'aws4fetch';

// Environment variables (set in EdgeOne Dashboard)
// - R2_ACCESS_KEY_ID
// - R2_SECRET_ACCESS_KEY
// - R2_ENDPOINT
// - R2_BUCKET_NAME
// - R2_PUBLIC_URL

/**
 * Create AWS client for R2 S3-compatible API
 */
function createR2Client(env) {
    return new AwsClient({
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        service: 's3',
        region: 'auto',
    });
}

/**
 * Get the R2 endpoint URL for a given key
 */
function getR2Url(env, key) {
    return `${env.R2_ENDPOINT}/${env.R2_BUCKET_NAME}/${key}`;
}

/**
 * Get config.yml content from R2 (via public URL for reading)
 */
export async function getConfig(env) {
    const url = `${env.R2_PUBLIC_URL}/config.yml`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.status}`);
    }

    return await response.text();
}

/**
 * Save config.yml to R2 with automatic backup
 */
export async function saveConfig(env, content) {
    const client = createR2Client(env);

    // 1. Create backup first
    await createBackup(env, client);

    // 2. Save new config
    const url = getR2Url(env, 'config.yml');
    const response = await client.fetch(url, {
        method: 'PUT',
        body: content,
        headers: {
            'Content-Type': 'text/yaml',
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save config: ${response.status} - ${errorText}`);
    }

    // 3. Cleanup old backups (keep latest 10)
    await cleanupOldBackups(env, client);

    return { success: true };
}

/**
 * Create a timestamped backup of config.yml
 */
async function createBackup(env, client) {
    try {
        // Get current config
        const currentConfig = await getConfig(env);

        // Create backup with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupKey = `config.backup.${timestamp}.yml`;
        const url = getR2Url(env, backupKey);

        const response = await client.fetch(url, {
            method: 'PUT',
            body: currentConfig,
            headers: {
                'Content-Type': 'text/yaml',
            },
        });

        if (!response.ok) {
            console.error(`Failed to create backup: ${response.status}`);
        }

        return backupKey;
    } catch (error) {
        console.error('Backup creation failed:', error);
        // Continue even if backup fails
    }
}

/**
 * List all backup files in the bucket
 */
async function listBackups(env, client) {
    const url = `${env.R2_ENDPOINT}/${env.R2_BUCKET_NAME}?prefix=config.backup.`;

    const response = await client.fetch(url, {
        method: 'GET',
    });

    if (!response.ok) {
        console.error(`Failed to list backups: ${response.status}`);
        return [];
    }

    const xml = await response.text();

    // Parse XML to extract backup keys
    const keyMatches = xml.matchAll(/<Key>([^<]+)<\/Key>/g);
    const backups = [];

    for (const match of keyMatches) {
        const key = match[1];
        if (key.startsWith('config.backup.')) {
            backups.push(key);
        }
    }

    // Sort by timestamp (newest first)
    backups.sort().reverse();

    return backups;
}

/**
 * Cleanup old backups, keeping only the latest 10
 */
async function cleanupOldBackups(env, client) {
    const MAX_BACKUPS = 10;

    try {
        const backups = await listBackups(env, client);

        if (backups.length <= MAX_BACKUPS) {
            return;
        }

        // Delete old backups
        const toDelete = backups.slice(MAX_BACKUPS);

        for (const key of toDelete) {
            const url = getR2Url(env, key);
            const response = await client.fetch(url, {
                method: 'DELETE',
            });

            if (!response.ok) {
                console.error(`Failed to delete backup ${key}: ${response.status}`);
            } else {
                console.log(`Deleted old backup: ${key}`);
            }
        }
    } catch (error) {
        console.error('Backup cleanup failed:', error);
        // Continue even if cleanup fails
    }
}

/**
 * Check if a user is an admin based on their email
 */
export function isAdminUser(env, userEmail) {
    if (!env.ADMIN_EMAILS || !userEmail) {
        return false;
    }

    const adminEmails = env.ADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase());
    return adminEmails.includes(userEmail.toLowerCase());
}
