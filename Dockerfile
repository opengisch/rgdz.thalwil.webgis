FROM ghcr.io/opengisch/qwc2_minimal-qwc2-minimal-builder:upgrade-to-qwc2-lts2024-1a4ea6633c9bc5b16026a641d8c7ec5a24ffaf08 as builder

COPY ./app/js/Help.jsx /app/js/Help.jsx
COPY ./app/js/SearchProviders.js /app/js/SearchProviders.js
COPY ./app/index.html /app/index.html
COPY ./app/static/translations/cs-CZ_overrides.json /app/static/translations/cs-CZ_overrides.json
COPY ./app/static/translations/de-CH_overrides.json /app/static/translations/de-CH_overrides.json
COPY ./app/static/translations/de-DE_overrides.json /app/static/translations/de-DE_overrides.json
COPY ./app/static/translations/en-US_overrides.json /app/static/translations/en-US_overrides.json
COPY ./app/static/translations/es-ES_overrides.json /app/static/translations/es-ES_overrides.json
COPY ./app/static/translations/fr-FR_overrides.json /app/static/translations/fr-FR_overrides.json
COPY ./app/static/translations/it-IT_overrides.json /app/static/translations/it-IT_overrides.json
COPY ./app/static/translations/pl-PL_overrides.json /app/static/translations/pl-PL_overrides.json
COPY ./app/static/translations/pt-BR_overrides.json /app/static/translations/pt-BR_overrides.json
COPY ./app/static/translations/ro-RO_overrides.json /app/static/translations/ro-RO_overrides.json
COPY ./app/static/translations/ru-RU_overrides.json /app/static/translations/ru-RU_overrides.json
COPY ./app/static/translations/sv-SE_overrides.json /app/static/translations/sv-SE_overrides.json
COPY ./app/static/translations/tr-TR_overrides.json /app/static/translations/tr-TR_overrides.json

WORKDIR /app

RUN /usr/bin/make clean build

#==============
# Stage prod
#==============

FROM nginx:1.23.2 as prod

COPY --from=builder /app/prod /usr/share/nginx/html
