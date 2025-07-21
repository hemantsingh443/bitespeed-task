# Bitespeed Identity Reconciliation

**Live Demo:** [https://bitespeed-task-wwit.onrender.com/](https://bitespeed-task-wwit.onrender.com/)

**Challenge Link:** [Bitespeed Backend Task: Identity Reconciliation](https://bitespeed.notion.site/Bitespeed-Backend-Task-Identity-Reconciliation-1fb21bb2a930802eb896d4409460375c)

This project implements the backend for Bitespeed’s identity reconciliation challenge, designed to link customer identities across multiple purchases, even when different emails or phone numbers are used.  
It exposes a single endpoint `/identify` that consolidates and returns a customer’s contact information according to the rules described in the problem statement.

---

## Features

- **POST /identify**: Accepts an email and/or phone number, and returns the consolidated contact profile.
- **Automatic linking**: Contacts with shared email or phone are linked, with the oldest as "primary".
- **Handles merges**: If two primaries are found to be the same person, merges them.
- **Extensible**: Built with Node.js, TypeScript, Express, and Prisma ORM.

---

## Tech Stack

- **Node.js** + **TypeScript**
- **Express** (API server)
- **Prisma** (ORM)
- **PostgreSQL** (database, can be swapped for any SQL DB)

---

## Setup & Running Locally

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/bitespeed-identity-reconciliation.git
   cd bitespeed-identity-reconciliation
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure your database**
   - Set your database connection string in `.env`:
     ```
     DATABASE_URL="your_postgres_connection_string"
     DIRECT_URL="your_postgres_direct_connection_string"
     ```

4. **Push the Prisma schema**
   ```bash
   npx prisma db push
   ```

5. **Generate the Prisma client**
   ```bash
   npx prisma generate
   ```

6. **Start the server**
   ```bash
   npm run dev
   ```
   The server will run on [http://localhost:3000](http://localhost:3000) by default.

---

## API Usage

### Endpoint

```
POST /identify
Content-Type: application/json
```

#### Request Body

```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}
```
- At least one of `email` or `phoneNumber` must be provided.

#### Response

```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [23]
  }
}
```

#### Example cURL (using deployed backend)

```bash
curl -X POST https://bitespeed-task-wwit.onrender.com/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"final-test@hillvalley.edu","phoneNumber":"999999"}'
```

---

## Code Structure & Key Files

### 1. Service Logic (`src/services/contact.service.ts`)

Handles the core reconciliation logic:

```ts
import { PrismaClient, Contact } from '@prisma/client';

const prisma = new PrismaClient();

export const identifyContact = async (email?: string, phoneNumber?: string) => {
    // ...find or create contacts, merge logic, etc...
    return formatResponse(allContactsInGroup);
};

const formatResponse = (contacts: Contact[]) => {
    // ...formats the response as required...
};
```

### 2. Controller (`src/controllers/contact.controller.ts`)

Handles HTTP requests and responses:

```ts
import { Request, Response } from 'express';
import { identifyContact } from '../services/contact.service';

export const identify = async (req: Request, res: Response) => {
    const { email, phoneNumber } = req.body;
    if (!email && !phoneNumber) {
        return res.status(400).json({ error: 'Either email or phoneNumber must be provided.' });
    }
    try {
        const result = await identifyContact(email, phoneNumber?.toString());
        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
```

### 3. Routes (`src/routes/contact.routes.ts`)

Defines the API route:

```ts
import { Router } from 'express';
import { identify } from '../controllers/contact.controller';

const router = Router();
router.post('/identify', identify);
export default router;
```

### 4. Server Entry (`src/index.ts`)

Starts the Express server:

```ts
import express from 'express';
import contactRoutes from './routes/contact.routes';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(express.json());
app.use('/', contactRoutes);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
```

---

## Database Schema

See `prisma/schema.prisma` for the full schema.  
The main model is:

```prisma
model Contact {
  id             Int      @id @default(autoincrement())
  phoneNumber    String?
  email          String?
  linkedId       Int?
  linkPrecedence String   // 'primary' or 'secondary'
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deletedAt      DateTime?
}
```

---

## Deployment

You can deploy this app to any Node.js hosting provider (e.g., Render, Railway, Heroku).  
Just set your environment variables and run:

```bash
npm run build
npm start
```

---

## License

ISC

---

**Note:**  
- Use JSON body for requests, not form-data.
