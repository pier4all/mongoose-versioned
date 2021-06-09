# Versioning Module MongoDB
Module for versioning in MongoDB, inspired by Vermongo (https://www.npmjs.com/package/mongoose-vermongo and https://github.com/thiloplanz/v7files/wiki/Vermongo).
Transactions are supported (see instructions below). 
This module allows to keep the change history of every document and the deleted documents. The idea is to have a "main collection" storing the current document versions and a different collection called "shadow collection" to keep all the past versions and deleted docuemnts.



## Instructions

Include it as schema plugin
[code snippet]

Transactions
[code snippet]