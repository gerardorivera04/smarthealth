FROM mysql:8.0

ENV MYSQL_ROOT_PASSWORD=smarthealth_root
ENV MYSQL_DATABASE=smarthealth
ENV MYSQL_USER=smarthealth
ENV MYSQL_PASSWORD=smarthealth_pw

COPY init.sql /docker-entrypoint-initdb.d/01_init.sql
COPY seed.sql /docker-entrypoint-initdb.d/02_seed.sql

EXPOSE 3306
