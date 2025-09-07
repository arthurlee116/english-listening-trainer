const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./data/app.db'
    }
  }
});

async function checkAdmin() {
  try {
    const admin = await prisma.user.findUnique({
      where: {
        email: 'admin@listeningtrain.com'
      },
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
        createdAt: true
      }
    });

    if (admin) {
      console.log('管理员账号信息:');
      console.log('ID:', admin.id);
      console.log('邮箱:', admin.email);
      console.log('姓名:', admin.name);
      console.log('管理员权限:', admin.isAdmin);
      console.log('创建时间:', admin.createdAt);
    } else {
      console.log('未找到管理员账号');
    }
  } catch (error) {
    console.error('查询管理员账号失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdmin();