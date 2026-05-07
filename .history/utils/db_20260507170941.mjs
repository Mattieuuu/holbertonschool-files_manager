import pkg from 'mongodb';

const { MongoClient } = pkg;

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || '27017';
    const database = process.env.DB_DATABASE || 'files_manager';

    this.url = `mongodb://${host}:${port}`;
    this.databaseName = database;
    this.client = new MongoClient(this.url, { useUnifiedTopology: true });
    this.connected = false;

    this.client.connect()
      .then(() => {
        this.db = this.client.db(this.databaseName);
        this.connected = true;
      })
      .catch((err) => {
        console.error('MongoDB connection error', err);
        this.connected = false;
      });
  }

  isAlive() {
    return this.connected === true;
  }

  getDB() {
    return this.db;
  }

  async nbUsers() {
    try {
      if (!this.db) return 0;
      const count = await this.db.collection('users').countDocuments();
      return count;
    } catch (err) {
      return 0;
    }
  }

  async nbFiles() {
    try {
      if (!this.db) return 0;
      const count = await this.db.collection('files').countDocuments();
      return count;
    } catch (err) {
      return 0;
    }
  }
}

const dbClient = new DBClient();

export default dbClient;
