import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Airline } from 'src/shared/entities/airline.entity';
import { Repository } from 'typeorm';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

@Injectable()
export class AirlineService implements OnApplicationBootstrap {
    constructor(@InjectRepository(Airline) private readonly airlineRepository: Repository<Airline>) {}

    /** [@Description:
     * Called after all modules have been initialized and database is ready.
     * Automatically generates the airline JSON file on application startup.]
     * @author: Prashant Joshi at 01-10-2025 **/
    async onApplicationBootstrap(): Promise<void> {
        try {
            const filePath = join(process.cwd(), 'json', 'airline_en.json');

            // Check if file is missing
            if (!existsSync(filePath)) {
                console.log('Airline JSON file not found. Creating from database...');
                await this.airlinesJson();
                console.log('Airline JSON file generated successfully');
                return;
            }

            // Check if file is empty or has no data
            if (this.isJsonFileEmpty(filePath)) {
                console.log('Airline JSON file is empty. Regenerating from database...');
                await this.airlinesJson();
                console.log('Airline JSON file regenerated successfully');
                return;
            }

            console.log('Airline JSON file already exists with data');
        } catch (error) {
            console.error('Failed to generate airline JSON file on application bootstrap:', error);
        }
    }

    /** [@Description:
     * Fetch all airlines from the database and update json/airline_en.json file.
     * The JSON file will contain an object with airline codes as keys and names as values.]
     * @author: Prashant Joshi at 01-10-2025 **/
    async airlinesJson(): Promise<Record<string, string>> {
        // Fetch all airlines from the database
        const airlines = await this.airlineRepository.find();

        // Prepare the data in the existing JSON format (code as key, name as value)
        const airlineObject: Record<string, string> = {};
        airlines.forEach((airline) => {
            airlineObject[airline.code] = airline.name;
        });

        // Ensure the output directory exists
        const outputDir = join(process.cwd(), 'json');
        mkdirSync(outputDir, { recursive: true });

        // Write the data to json/airline_en.json
        const filePath = join(outputDir, 'airline_en.json');
        writeFileSync(filePath, JSON.stringify(airlineObject, null, 2));

        return airlineObject;
    }

    /** [@Description: Check if JSON file is empty or contains no data]
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
