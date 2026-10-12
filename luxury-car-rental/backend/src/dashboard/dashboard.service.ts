
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

// Structure des statistiques des véhicules
// et des réservations.
interface StatusStatistics {
    total: number;
    byStatus: Record<string, number>;
}

// Structure complète de la réponse du dashboard.
export interface DashboardSummary {
    vehicles: StatusStatistics;
    reservations: StatusStatistics;
    customers: {
        total: number;
    };
}

// Structure des résultats retournés par PostgreSQL.
interface StatusCountRow {
    status: string;
    total: number;
}

interface TotalCountRow {
    total: number;
}

@Injectable()
export class DashboardService {
    constructor(
        // Utiliser la connexion PostgreSQL existante.
        private readonly dataSource: DataSource,
    ) { }

    // Transformer les lignes SQL en statistiques.
    private buildStatistics(
        rows: StatusCountRow[],
    ): StatusStatistics {
        const byStatus: Record<string, number> = {};

        let total = 0;

        for (const row of rows) {
            // Convertir le résultat en nombre.
            const count = Number(row.total);

            // Enregistrer le nombre pour chaque statut.
            byStatus[row.status] = count;

            // Calculer le total.
            total += count;
        }

        return {
            total,
            byStatus,
        };
    }

    // Récupérer les statistiques générales.
    async getSummary(): Promise<DashboardSummary> {
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
        const [
            vehicleRows,
            reservationRows,
            customerRows,
        ] = await Promise.all([
            this.dataSource.query(
                vehiclesQuery,
            ) as Promise<StatusCountRow[]>,

            this.dataSource.query(
                reservationsQuery,
            ) as Promise<StatusCountRow[]>,

            this.dataSource.query(
                customersQuery,
            ) as Promise<TotalCountRow[]>,
        ]);

        // Construire la réponse destinée au frontend.
        return {
            vehicles: this.buildStatistics(
                vehicleRows,
            ),

            reservations: this.buildStatistics(
                reservationRows,
            ),

            customers: {
                total: Number(
                    customerRows[0]?.total ?? 0,
                ),
            },
        };
    }
}
