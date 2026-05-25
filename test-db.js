const { PrismaClient } =
    require("@prisma/client");

const prisma =
    new PrismaClient();

async function main() {

    const user =
        await prisma.user.create({

            data: {
                id: "test-user",
                refreshToken:
                    "test-token",
            },
        });

    console.log(user);
}

main();