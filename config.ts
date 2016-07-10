export = {
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: process.env.DB_PORT || 28015,
    DB_NAME: process.env.DB_NAME || 'mojichat',
    SERVER_PORT: process.env.SERVER_PORT || 3000,
    SECRET: process.env.SECRET || '9rcudLIpPZQ2r8W',
    SMTP_OPTIONS: {
        host: 'webmail.fitcom.co',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
            user: 'noreply@fitcom.co',
            pass: 'xGRzPpfvhp'
        }
    }
}