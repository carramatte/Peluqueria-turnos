# Guía de Workflows n8n — Peluquería Turnos

## Cómo importar el workflow

1. Abrí n8n en `http://localhost:5678`
2. Ingresá con usuario `admin` / contraseña `admin123`
3. Hacé clic en **"+"** → **"Import from file"**
4. Seleccioná el archivo `workflows/whatsapp-turnos.json`
5. Hacé clic en **"Save"** y luego **"Activate"**

---

## Flujo 1: Recepción de Mensajes (Webhook)

Este flujo procesa mensajes entrantes de WhatsApp, Instagram y Facebook.

```
Webhook → Extraer Datos → Parsear Mensaje → Switch Intención
                                                ├── Saludo → Responder bienvenida
                                                ├── Disponibilidad → Consultar API → Responder horarios
                                                ├── Reservar → Crear turno en API → Responder confirmación
                                                ├── Cancelar → Responder instrucciones
                                                └── Desconocido → Responder ayuda
```

### Nodos explicados

| Nodo | Qué hace | Por qué se usa |
|---|---|---|
| **Webhook WhatsApp** | Recibe POST en `/webhook/whatsapp-webhook` | Es el punto de entrada del proveedor de mensajería |
| **Extraer Datos** | Saca `phone`, `message`, `name`, `channel` del body | Normaliza los datos sin importar el proveedor |
| **Parsear Mensaje** | Detecta intención (regex), extrae fecha/hora/servicio | NLP básico sin dependencias externas |
| **Switch Intención** | Bifurca según: saludo, disponibilidad, reserva, cancelación | Cada intención tiene un flujo diferente |
| **Consultar Disponibilidad** | GET a `http://backend:3000/api/availability` | Obtiene horarios libres del backend |
| **Crear Turno** | POST a `http://backend:3000/api/appointments` | Registra el turno en la base de datos |
| **Enviar Respuesta** | Devuelve el mensaje al webhook caller | El proveedor de WhatsApp reenvía al cliente |

### URL del Webhook

Después de activar el workflow, la URL del webhook será:

```
http://localhost:5678/webhook/whatsapp-webhook
```

Para pruebas con curl:

```bash
curl -X POST http://localhost:5678/webhook/whatsapp-webhook \
  -H "Content-Type: application/json" \
  -d '{"from": "+5491112345678", "name": "Juan", "message": "Hola, quiero un turno mañana a las 10 para corte", "channel": "whatsapp"}'
```

---

## Flujo 2: Recordatorios Automáticos (Cron)

```
Cron (5 min) → Buscar turnos próximos → ¿Hay? → Sí → Separar → Formatear recordatorio → Marcar enviado
                                                 → No → Fin
```

### Nodos explicados

| Nodo | Qué hace |
|---|---|
| **Cron** | Se ejecuta cada 5 minutos |
| **Buscar Turnos Próximos** | GET a `/api/appointments/pending-reminders` |
| **¿Hay turnos?** | Verifica si hay turnos en los próximos 15 min |
| **Separar por Turno** | Procesa cada turno individualmente |
| **Formatear Recordatorio** | Construye mensaje amigable de recordatorio |
| **Marcar Enviado** | PUT para no enviar el recordatorio dos veces |

---

## Configurar proveedor de WhatsApp

Para conectar con WhatsApp real, tenés que:

1. **Elegir proveedor**: Meta Business API, Twilio, o similar
2. **Configurar webhook**: Apuntar el webhook del proveedor a `http://TU-IP:5678/webhook/whatsapp-webhook`
3. **Exponer con tunnel**: Usar [ngrok](https://ngrok.com/) para desarrollo:
   ```bash
   ngrok http 5678
   ```
4. **Agregar nodo de envío**: Después de "Formatear Respuesta", agregar un nodo HTTP Request que llame a la API del proveedor para enviar el mensaje.

### Ejemplo con Meta Business API

Agregar un nodo HTTP Request apuntando a:
```
POST https://graph.facebook.com/v17.0/PHONE_NUMBER_ID/messages
```

Con headers:
```
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json
```

### Soporte Multi-Canal

El campo `channel` en el body del webhook permite identificar si el mensaje viene de:
- `whatsapp` — WhatsApp Business
- `instagram` — Instagram DM
- `facebook` — Facebook Messenger

Cada proveedor tendrá su propia configuración de webhook, pero todos envían al mismo endpoint de n8n.
