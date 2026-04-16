import { DocumentBuilder } from '@nestjs/swagger';
 
export const SwaggerConfig = new DocumentBuilder()
  .setTitle('API SERVICE')
  .addBearerAuth()
  .addCookieAuth('auth')  
  .setDescription(
    '## Travel API Documentation\n\n' +
      'Welcome to the **API SERVICE** documentation. This guide provides comprehensive guidelines and detailed instructions on how to effectively integrate and utilize the Travel API.\n\n' +
      '### Overview\n' +
      'This documentation includes various sections covering:\n' +
      '- **Authentication Methods**: Learn how to authenticate using Bearer and Cookie authentication.\n' +
      '- **Endpoint Descriptions**: Detailed information on each API endpoint.\n' +
      '- **Usage Examples**: Practical examples to help you get started quickly.\n' +
      '- **Best Practices**: Tips and recommendations for efficient implementation.\n\n' +
      '### Purpose\n' +
      'Whether you are a developer looking to incorporate travel-related functionalities or a business aiming to enhance your travel services, this documentation serves as a valuable resource to guide you through the process.\n\n' +
      '### Getting Started\n' +
      'To get started, ensure you have the necessary authentication tokens and follow the endpoint descriptions to make your first API call.\n\n' +
      'For any questions or support, please refer to the contact section at the end of this documentation.',
  )
  .setVersion('1.0')
  // .addGlobalParameters({
  //   name: 'language',
  //   description: 'Enter language code(ex. en)',
  //   in: 'header',
  // })
  .build();
 
 