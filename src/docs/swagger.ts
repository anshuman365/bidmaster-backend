import { Application } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { version } from '../../package.json';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BidMaster API Documentation',
      version,
      description: 'API documentation for BidMaster - Online Bidding Platform',
      contact: {
        name: 'BidMaster Support',
        email: 'support@bidmaster.com',
        url: 'https://bidmaster.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development Server'
      },
      {
        url: 'https://bidmaster-backend.onrender.com',
        description: 'Production Server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token in the format: Bearer <token>'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com'
            },
            firstName: {
              type: 'string',
              example: 'John'
            },
            lastName: {
              type: 'string',
              example: 'Doe'
            },
            role: {
              type: 'string',
              enum: ['admin', 'company', 'bidder'],
              example: 'bidder'
            },
            isVerified: {
              type: 'boolean',
              example: true
            },
            profilePicture: {
              type: 'string',
              nullable: true,
              example: 'https://example.com/profile.jpg'
            }
          }
        },
        Auction: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000'
            },
            title: {
              type: 'string',
              example: 'Industrial Generator 5000W'
            },
            description: {
              type: 'string',
              example: 'Brand new industrial generator with warranty'
            },
            category: {
              type: 'string',
              enum: ['machinery', 'vehicles', 'property', 'goods', 'services'],
              example: 'machinery'
            },
            status: {
              type: 'string',
              enum: ['draft', 'scheduled', 'live', 'paused', 'ended', 'cancelled', 'sold'],
              example: 'live'
            },
            currentHighestBid: {
              type: 'number',
              example: 15000
            },
            totalBids: {
              type: 'integer',
              example: 25
            }
          }
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Operation successful'
            },
            data: {
              type: 'object',
              nullable: true
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'An error occurred'
            },
            error: {
              type: 'string',
              nullable: true
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Access token is missing or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: 'Not authorized to access this route'
              }
            }
          }
        },
        NotFoundError: {
          description: 'The specified resource was not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: 'Resource not found'
              }
            }
          }
        },
        ValidationError: {
          description: 'Validation failed',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: 'Validation failed',
                errors: ['Email is required', 'Password must be at least 6 characters']
              }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints'
      },
      {
        name: 'Users',
        description: 'User management endpoints'
      },
      {
        name: 'Auctions',
        description: 'Auction management endpoints'
      },
      {
        name: 'Bids',
        description: 'Bid placement and management'
      },
      {
        name: 'Payments',
        description: 'Payment processing and history'
      },
      {
        name: 'Admin',
        description: 'Administrator-only endpoints'
      }
    ]
  },
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
    './src/models/*.ts'
  ]
};

const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app: Application): void => {
  // Swagger page
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Docs in JSON format
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  console.log('📚 Swagger docs available at /api-docs');
};