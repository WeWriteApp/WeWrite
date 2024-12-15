// Mock Google Cloud Logging implementation
export class Logging {
  constructor(config) {
    this.config = config;
  }

  log(name) {
    return {
      entry: (metadata, data) => ({ metadata, data }),
      write: async () => Promise.resolve()
    };
  }
}
