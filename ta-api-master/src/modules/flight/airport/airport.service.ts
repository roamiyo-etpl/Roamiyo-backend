import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Airports } from 'src/shared/entities/airports.entity';
import { Repository } from 'typeorm';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

@Injectable()
export class AirportService implements OnApplicationBootstrap {
    constructor(@InjectRepository(Airports) private readonly airportRepository: Repository<Airports>) {}

    /** [@Description:
     * Called after all modules have been initialized and database is ready.
     * Automatically generates the airport JSON file on application startup.]
     * @author: Prashant Joshi at 01-10-2025 **/
    async onApplicationBootstrap(): Promise<void> {
        try {
            const filePath = join(process.cwd(), 'json', 'airport_en.json');

            // Check if file is missing
            if (!existsSync(filePath)) {
                console.log('Airport JSON file not found. Creating from database...');
                await this.airportsJson();
                console.log('Airport JSON file generated successfully');
                return;
            }

            // Check if file is empty or has no data
            if (this.isJsonFileEmpty(filePath)) {
                console.log('Airport JSON file is empty. Regenerating from database...');
                await this.airportsJson();
                console.log('Airport JSON file regenerated successfully');
                return;
            }

            console.log('Airport JSON file already exists with data');
        } catch (error) {
            console.error('Failed to generate airport JSON file on application bootstrap:', error);
        }
    }

    /** [@Description:
     * Fetch all airports from the database and update json/airport_en.json file.
     * The JSON file will contain an object with airport codes as keys and airport objects as values.
     * @author: Prashant Joshi at 01-10-2025 **/
    async airportsJson(): Promise<Record<string, any>> {
        // Fetch all airports from the database
        const airports = await this.airportRepository.find();

        // Prepare the data in the existing JSON format (code as key, airport object as value)
        const airportObject: Record<string, any> = {};
        airports.forEach((airport) => {
            airportObject[airport.code] = {
                id: airport.id,
                name: airport.name,
                lat: airport.latitude,
                long: airport.longitude,
                code: airport.code,
                city: airport.city,
                country: airport.country,
                region: airport.state || '', // Using state as region, or empty string if null
            };
        });

        // Ensure the output directory exists
        const outputDir = join(process.cwd(), 'json');
        mkdirSync(outputDir, { recursive: true });

        // Write the data to json/airport_en.json
        const filePath = join(outputDir, 'airport_en.json');
        writeFileSync(filePath, JSON.stringify(airportObject, null, 2));

        return airportObject;
    }

    /** [@Description:
     * Check if JSON file is empty or contains no data
     * @author: Prashant Joshi at 01-10-2025 **/
    private isJsonFileEmpty(filePath: string): boolean {
        try {
            const fileContent = readFileSync(filePath, 'utf8').trim();

            // If file is empty or whitespace only, return true
            if (!fileContent || fileContent.length === 0) {
                return true;
            }

            // Try to parse and check if object is empty
            const parsedContent = JSON.parse(fileContent);
            return Object.keys(parsedContent).length === 0;
        } catch (error) {
            // If JSON parsing fails, consider file as empty/invalid
            return true;
        }
    }
}
