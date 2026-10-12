function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") {
        r = Reflect.decorate(decorators, target, key, desc);
    } else {
        for(var i = decorators.length - 1; i >= 0; i--){
            if (d = decorators[i]) {
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
            }
        }
    }
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(metadataKey, metadataValue) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") {
        return Reflect.metadata(metadataKey, metadataValue);
    }
}
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
export class DashboardService {
    // Transformer les lignes SQL en statistiques.
    buildStatistics(rows) {
        const byStatus = {};
        let total = 0;
        for (const row of rows){
            // Convertir le résultat en nombre.
            const count = Number(row.total);
            // Enregistrer le nombre pour chaque statut.
            byStatus[row.status] = count;
            // Calculer le total.
            total += count;
        }
        return {
            total,
            byStatus
        };
    }
    // Récupérer les statistiques générales.
    async getSummary() {
        // Compter les véhicules par statut.
        const vehiclesQuery = `
      SELECT
        status::text AS status,
        COUNT(*)::integer AS total
      FROM vehicles
      GROUP BY status
    `;
        // Compter les réservations par statut.
        const reservationsQuery = `
      SELECT
        status::text AS status,
        COUNT(*)::integer AS total
      FROM reservations
      GROUP BY status
    `;
        // Compter les clients ayant un profil.
        const customersQuery = `
      SELECT
        COUNT(*)::integer AS total
      FROM customer_profiles
    `;
        // Exécuter les trois requêtes de lecture.
        const [vehicleRows, reservationRows, customerRows] = await Promise.all([
            this.dataSource.query(vehiclesQuery),
            this.dataSource.query(reservationsQuery),
            this.dataSource.query(customersQuery)
        ]);
        // Construire la réponse destinée au frontend.
        return {
            vehicles: this.buildStatistics(vehicleRows),
            reservations: this.buildStatistics(reservationRows),
            customers: {
                total: Number(customerRows[0]?.total ?? 0)
            }
        };
    }
    constructor(// Utiliser la connexion PostgreSQL existante.
    dataSource){
        this.dataSource = dataSource;
    }
}
DashboardService = _ts_decorate([
    Injectable(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof DataSource === "undefined" ? Object : DataSource
    ])
], DashboardService);

//# sourceMappingURL=dashboard.service.js.map