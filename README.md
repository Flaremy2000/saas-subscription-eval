# SaaS Subscription Management System

## Arquitectura

Este proyecto sigue una arquitectura de microservicios utilizando Docker Compose para orquestar tres componentes principales:

1. **PostgreSQL** - Base de datos para almacenar datos de suscripción, usuarios y licencias
2. **Backend (Node.js/TypeScript)** - API REST que expone endpoints para gestión de licencias y consumo
3. **Frontend (Vue.js)** - Dashboard interactivo para visualizar y gestionar licencias de usuarios

## Instrucciones de Ejecución

### Comando Único para Levantar Todo

```bash
docker-compose up --build
```

Esto construirá e iniciará automáticamente:
- PostgreSQL en el puerto 5432
- Backend en el puerto 3000
- Frontend en el puerto 5173
- pgAdmin4 en el puerto 5050 (para conexión a DB)

### Conexión a la Base de Datos

1. **Por terminal**: `psql -U postgres -d saas_subscription -h localhost -p 5432`
2. **Por interfaz gráfica**: Conecta pgAdmin4 en http://localhost:5050
   - Usuario: admin@example.com
   - Contraseña: admin

### Pruebas

**Backend**:
```bash
cd backend
docker exec -it saas-subscription-backend sh
npm test
```

**Frontend**:
```bash
cd frontend
docker exec -it saas-subscription-frontend sh
npm run test:unit
```

**PostgreSQL**:
- Usando terminal: `psql` (como se muestra arriba)
- Usando pgAdmin4: Inicie pgAdmin4 en http://localhost:5050 y cree una conexión a `localhost:5432`

### Servicios

- **Backend**: http://localhost:3000/api
- **Frontend**: http://localhost:5173
- **pgAdmin4**: http://localhost:5050
