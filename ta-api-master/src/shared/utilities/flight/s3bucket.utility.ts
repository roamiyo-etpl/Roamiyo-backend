import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, ObjectCannedACL } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import { GenericRepo } from './generic-repo.utility';
import { Generic } from './generic.utility';

@Injectable()
export class s3BucketService {
    constructor(
        private configService: ConfigService,
        private genericRepo: GenericRepo,
    ) {}

    async transferFlightLogsToS3(logPath, bucketPath) {
        try {
            const AWSCredentials = {
                accessKey: this.configService.get('s3.accessKey'),
                secret: this.configService.get('s3.secretKey'),
                bucketName: 'mwr_travels_db',
                region: this.configService.get('s3.awsRegion'),
            };

            const s3Client = new S3Client({
                // region: AWSCredentials.region,
                credentials: {
                    accessKeyId: AWSCredentials.accessKey,
                    secretAccessKey: AWSCredentials.secret,
                },
            });

            const today = new Date();
            const priorDate = new Date(new Date().setDate(today.getDate() - 15));

            const files = fs.readdirSync(logPath);

            for (const file of files) {
                const stats = fs.statSync(logPath + file);
                if (stats.birthtime <= priorDate) {
                    const fileContent = fs.readFileSync(logPath + file);

                    const params = {
                        Bucket: AWSCredentials.bucketName,
                        Key: bucketPath + file,
                        Body: fileContent,
                        ACL: ObjectCannedACL.public_read,
                        ContentType: 'text/html',
                    };

                    try {
                        const command = new PutObjectCommand(params);
                        await s3Client.send(command);

                        // Remove the file after successful upload
                        fs.unlinkSync(logPath + file);
                    } catch (err) {
                        // Error logging
                        this.genericRepo.storeLogs('', 1, err, 0);
                    }
                }
            }
        } catch (error) {
            /* error logging */
            this.genericRepo.storeLogs('', 1, error, 0);
            throw new InternalServerErrorException('There is an issue while moving logs in s3 bucket.');
        }
    }

    /** [@Description: Used to move the logs directly to S3]
     * @author: Prashant Joshi at 23-09-2025 **/
    async generateS3LogFile(fileName, logData, folderName) {
        /* Run the code only in production server */
        if (process.env.NODE_ENV == 'production') {
            const bucketPath = 'logs/flight_logs/' + folderName + '/';
            try {
                const AWSCredentials = {
                    accessKey: this.configService.get('s3.accessKey'),
                    secret: this.configService.get('s3.secretKey'),
                    bucketName: 'mwr_travels_db',
                    region: this.configService.get('s3.awsRegion'),
                };

                const s3Client = new S3Client({
                    region: AWSCredentials.region, // specify your AWS region
                    credentials: {
                        accessKeyId: AWSCredentials.accessKey,
                        secretAccessKey: AWSCredentials.secret,
                    },
                });

                // Setting up S3 upload parameters
                const params = {
                    Bucket: AWSCredentials.bucketName,
                    Body: JSON.stringify(logData),
                    Key: bucketPath + fileName + '.json',
                    ACL: ObjectCannedACL.public_read,
                    ContentType: 'text/html',
                };

                // Uploading files to the bucket
                const command = new PutObjectCommand(params);
                try {
                    await s3Client.send(command);
                } catch (err) {
                    // Error logging
                    console.log(err);
                    this.genericRepo.storeLogs('', 1, err, 0);
                }
            } catch (error) {
                console.log(error);
                /* error logging */
                this.genericRepo.storeLogs('', 1, error, 0);
            }
        } else {
            /* Store the logs in server only */
            Generic.generateLogFile(fileName, logData, folderName);
        }
    }

    /** [@Description: Used to store the logs into S3]
     * @author: Prashant Joshi at 23-09-2025 **/
    async generateS3LogFileHotel(fileName, logData, folderName) {
        /* Run the code only in production server */
        if (process.env.NODE_ENV == 'production') {
            const bucketPath = 'logs/hotel_logs/' + folderName + '/';
            try {
                const AWSCredentials = {
                    accessKey: this.configService.get('s3.accessKey'),
                    secret: this.configService.get('s3.secretKey'),
                    bucketName: 'mwr_travels_db',
                    region: this.configService.get('s3.awsRegion'),
                };

                const s3Client = new S3Client({
                    region: AWSCredentials.region, // specify your AWS region
                    credentials: {
                        accessKeyId: AWSCredentials.accessKey,
                        secretAccessKey: AWSCredentials.secret,
                    },
                });

                // Setting up S3 upload parameters
                const params = {
                    Bucket: AWSCredentials.bucketName,
                    Body: JSON.stringify(logData),
                    Key: bucketPath + fileName + '.json',
                    ACL: ObjectCannedACL.public_read,
                    ContentType: 'text/html',
                };

                // Uploading files to the bucket
                const command = new PutObjectCommand(params);
                try {
                    await s3Client.send(command);
                } catch (err) {
                    // Error logging
                    console.log(err);
                    this.genericRepo.storeLogs('', 1, err, 0);
                }
            } catch (error) {
                console.log(error);
                /* error logging */
                this.genericRepo.storeLogs('', 1, error, 0);
            }
        } else {
            /* Store the logs in server only */
            // HotelGeneric.generateLogFileHotel(fileName, logData, folderName);
        }
    }
}
