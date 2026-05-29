import chalk from 'chalk';

export const log = {
  info:    (msg) => console.log(chalk.cyan('  ℹ'), msg),
  success: (msg) => console.log(chalk.green('  ✓'), msg),
  warn:    (msg) => console.log(chalk.yellow('  ⚠'), msg),
  error:   (msg) => console.log(chalk.red('  ✗'), msg),
  step:    (n, msg) => console.log(chalk.bold.white(`\n  [${n}]`) + ' ' + chalk.bold(msg)),
  dim:     (msg) => console.log(chalk.dim('    ' + msg)),
  blank:   ()    => console.log(),
};
