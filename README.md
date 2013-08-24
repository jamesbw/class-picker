class-picker
============

To run locally, in the main directory, run python -m SimpleHTTPServer 8888.
Then in a browser, navigate to http://localhost:8888/index.html.

## Updating programs
* The source of truth for programs is at http://exploredegrees.stanford.edu/schoolofengineering/computerscience/#masterstext
* The data for the masters is copied into parsing/masters.html. This file also contains a script that will parse the html and generate the JSON representation of the programs. Just open masters.hmtl in a browser and the JSON will be printed on screen. Copy this to the allprograms.json file.
* Check the diff, there will be some minor fixups because there are some special cases in the Stanford Bulletin that are hard to parse.
* Load the main page index.html to see if it works. If there are new classes, then there will be exceptions.

## Updating the courses
* The source of truth is the explorecourses.stanford.edu website. There is an xml interface that can be queried, which makes parsing easier. See parsing/parse.py to see how this API is queried.
* The file parsing/parse.py will grab this information for each department and populate allcourses.json. No copy-pasting needed here.
* Make sure that the departments array in parse.py contains all the values needed for the courses listed in allprograms.json. 
* Load the main page index.html to see if it works. If all classes from allprograms.json have been fetched successfully, there should be no more exceptions.

## Updating the terms displayed
* This is done automatically based on the current date.