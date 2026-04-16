import { InternalServerErrorException } from '@nestjs/common/exceptions/internal-server-error.exception';
import * as fs from 'fs';
import { join } from 'path';
import path from 'path';

/** [@Description: Airports]
 * @author: Prashant Joshi at 23-09-2025 **/
export function airportsDefault(language?) {
    const filePath = path.resolve(process.cwd(), `json/airport_${language || 'en'}.json`);

    try {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.warn(`Airport data file not found: airport_${language || 'en'}.json - returning empty object`);
            return {};
        }

        // Read the file content
        const fileContent = fs.readFileSync(filePath, 'utf8').trim();

        // Check if file is empty
        if (!fileContent || fileContent.length === 0) {
            console.warn(`Airport data file is empty: airport_${language || 'en'}.json - returning empty object`);
            return {};
        }

        // Parse and return the file
        const airportsObj = JSON.parse(fileContent);
        return airportsObj;
    } catch (error) {
        // If it's already our custom exception, re-throw it
        if (error instanceof InternalServerErrorException) {
            throw error;
        }
        // Handle JSON parse errors or other file read errors gracefully
        console.error(`Error reading airport data: ${error.message} - returning empty object`);
        return {};
    }
}

export const airports = airportsDefault('en');
