// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  // Example User seeding
  const users = await prisma.user.createMany({
    data: [
      {
        name: "Jane Doe",
        email: "jane@example.com",
        password: await bcrypt.hash("password123", 10),
      },
      {
        name: "Alice Johnson",
        email: "alice@example.com",
        password: await bcrypt.hash("password123", 10),
      },
    ],
  });

  console.log("User created:", users);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
