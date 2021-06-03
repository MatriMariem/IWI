
export const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'IWI API',
      version: '1.0.0',
      description: "IWI is a social platform connecting people sharing the same interests, mainly for community development. It allows people to find gigs, to join community clubs and to participate in events and initiatives.",
    },
  },
  apis: ['./swagger/docs/*'], // files containing annotations as above
};
