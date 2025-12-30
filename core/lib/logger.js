/**
 * Système de logging unifié pour RAWDIT
 * Niveaux: DEBUG, INFO, WARN, ERROR
 * Format: [TIMESTAMP] [LEVEL] [MODULE] Message
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const LOG_COLORS = {
  DEBUG: '\x1b[36m', // Cyan
  INFO: '\x1b[32m',  // Green
  WARN: '\x1b[33m',  // Yellow
  ERROR: '\x1b[31m', // Red
  RESET: '\x1b[0m',
};

class Logger {
  constructor() {
    // Niveau de log selon l'environnement
    const envLevel = process.env.LOG_LEVEL?.toUpperCase() || 
                     (process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG');
    this.level = LOG_LEVELS[envLevel] ?? LOG_LEVELS.INFO;
    this.useColors = process.stdout.isTTY && process.env.NO_COLOR !== '1';
  }

  formatTimestamp() {
    const now = new Date();
    return now.toISOString().replace('T', ' ').slice(0, -5);
  }

  log(level, module, message, ...args) {
    if (LOG_LEVELS[level] < this.level) return;

    const timestamp = this.formatTimestamp();
    const color = this.useColors ? LOG_COLORS[level] : '';
    const reset = this.useColors ? LOG_COLORS.RESET : '';
    
    const prefix = `${color}[${timestamp}] [${level.padEnd(5)}] [${module}]${reset}`;
    
    if (args.length > 0) {
      console.log(prefix, message, ...args);
    } else {
      console.log(prefix, message);
    }
  }

  debug(module, message, ...args) {
    this.log('DEBUG', module, message, ...args);
  }

  info(module, message, ...args) {
    this.log('INFO', module, message, ...args);
  }

  warn(module, message, ...args) {
    this.log('WARN', module, message, ...args);
  }

  error(module, message, ...args) {
    this.log('ERROR', module, message, ...args);
  }
}

// Instance singleton
export const logger = new Logger();
