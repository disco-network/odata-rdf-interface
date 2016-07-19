declare var __dirname: string;

let config: {
  port: number,
  publicRootDirectory: string,
  publicRelativeServiceDirectory: string,
  localRootDirectory: string,
} = {
  "port": 52999,
  "publicRootDirectory": "http://localhost:52999",
  "publicRelativeServiceDirectory": "",
  // @todo - localRootDirectory should not depend on directory depth!
  "localRootDirectory": __dirname.substr(0, __dirname.length - 8),
};

export = config;
