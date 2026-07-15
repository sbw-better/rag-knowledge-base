ALTER TABLE tenants
    ADD CONSTRAINT uk_tenants_name UNIQUE (name);
