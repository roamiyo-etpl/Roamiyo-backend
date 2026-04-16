import * as fs from 'fs';
import * as path from 'path';

function readJson(filePath: string): Record<string, string> {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, string>;
        }
    } catch (error) {
        console.error(`Error reading ${filePath}`, error);
    }
    return {};
}

function isValidTranslation(value: any): boolean {
    return typeof value === 'string' && value.trim() !== '';
}

export function getLanguageDictionary(language: string = 'english'): Record<string, string> {
    const basePath = path.join(process.cwd(), 'json/language');
    const englishPath = path.join(basePath, 'english.json');
    const langPath = path.join(basePath, `${language}.json`);

    const english = readJson(englishPath);
    const localized = language === 'english' ? {} : readJson(langPath);

    return new Proxy(
        {},
        {
            get: (_target, prop: string) => {
                if (isValidTranslation(localized[prop])) return localized[prop];
                if (isValidTranslation(english[prop])) return english[prop];
                return prop;
            },
        },
    );
}
