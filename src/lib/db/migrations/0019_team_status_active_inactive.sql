UPDATE `equipos` SET `estado` = 'activo' WHERE `estado` IN ('registrado', 'activo');
--> statement-breakpoint
UPDATE `equipos` SET `estado` = 'inactivo' WHERE `estado` IN ('finalizado', 'inactivo');
