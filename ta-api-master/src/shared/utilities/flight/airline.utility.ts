import { InternalServerErrorException } from '@nestjs/common/exceptions/internal-server-error.exception';
import * as fs from 'fs';
import { join } from 'path';
import path from 'path';

/** [@Description: Airlines]
 * @author: Prashant Joshi at 23-09-2025 **/
export function airlines(language?) {
    const filePath = path.resolve(process.cwd(), `json/airline_${language || 'en'}.json`);

    try {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.warn(`Airline data file not found: airline_${language || 'en'}.json - returning empty object`);
            return {};
        }

        // Read the file content
        const fileContent = fs.readFileSync(filePath, 'utf8').trim();

        // Check if file is empty
        if (!fileContent || fileContent.length === 0) {
            console.warn(`Airline data file is empty: airline_${language || 'en'}.json - returning empty object`);
            return {};
        }

        // Parse and return the file
        const airlinesObj = JSON.parse(fileContent);
        return airlinesObj;
    } catch (error) {
        // If it's already our custom exception, re-throw it
        if (error instanceof InternalServerErrorException) {
            throw error;
        }
        // Handle JSON parse errors or other file read errors gracefully
        console.error(`Error reading airline data: ${error.message} - returning empty object`);
        return {};
    }
}

// export const airlines = airline();
