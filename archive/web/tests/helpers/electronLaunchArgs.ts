export const getElectronLaunchArgs = (): string[] => [
  './dist-electron/main.js',
  ...(process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] : []),
];
