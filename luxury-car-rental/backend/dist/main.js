import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    // Enable global request validation
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true
    }));
    // Set security-related response headers on every response
    // (same defaults as helmet 8, X-Powered-By included in the
    // headers removed).
    app.useSecurityHeaders();
    // Reject cross-origin state-changing requests
    // (CSRF protection based on Fetch Metadata).
    app.enableCsrfProtection();
    // Release resources cleanly on shutdown
    // (SIGTERM/SIGINT) and close the DB connection.
    app.enableShutdownHooks();
    // Read the application port
    const configService = app.get(ConfigService);
    const port = configService.getOrThrow('PORT');
    // Start the backend
    await app.listen(port);
    Logger.log(`Backend running on http://localhost:${port}`, 'Bootstrap');
}
await bootstrap();

//# sourceMappingURL=main.js.map